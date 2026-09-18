import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { ensureDir, getStateDir, readJsonIfExists, writeSecureJson } from "../config/paths.js";
import { Workspace, WorkspaceError } from "../workspace/manager.js";

export const MAX_PATCH_BYTES = 256 * 1024;
export const MAX_PATCH_FILES = 32;
export const MAX_PATCH_PROPOSALS = 20;
const MAX_TARGET_BYTES = 16 * 1024 * 1024;

export type PatchProposalStatus = "pending" | "applied" | "rejected" | "failed";
export type PatchProposalRisk = "normal" | "approval-required";
export type PatchFileOperation = "create" | "modify" | "delete";

export type PatchProposalErrorCode =
  | "PATCH_TOO_LARGE"
  | "INVALID_PATCH"
  | "UNSAFE_PATCH_PATH"
  | "TOO_MANY_FILES"
  | "PROPOSAL_LIMIT"
  | "PROPOSAL_NOT_FOUND";

export class PatchProposalError extends Error {
  constructor(
    public readonly code: PatchProposalErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PatchProposalError";
  }
}

export interface TargetFingerprint {
  path: string;
  exists: boolean;
  sha256: string | null;
  sizeBytes: number;
}

export interface PatchProposalMeta {
  id: string;
  taskId: string;
  iteration: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  status: PatchProposalStatus;
  sizeBytes: number;
  sha256: string;
  fileCount: number;
  paths: string[];
  operations: { path: string; operation: PatchFileOperation }[];
  risk: PatchProposalRisk;
  riskReasons: string[];
  baseFiles: TargetFingerprint[];
}

interface ProposalIndex {
  items: PatchProposalMeta[];
}

export interface SavePatchProposalInput {
  taskId: string;
  iteration: number;
  patch: string;
  summary?: string;
}

function proposalDir(workspaceId: string): string {
  return ensureDir(path.join(getStateDir(), "patch-proposals", workspaceId));
}

function indexFile(workspaceId: string): string {
  return path.join(proposalDir(workspaceId), "index.json");
}

function patchFile(workspaceId: string, id: string): string {
  return path.join(proposalDir(workspaceId), "bodies", `${id}.patch`);
}

function readIndex(workspaceId: string): ProposalIndex {
  const raw = readJsonIfExists<ProposalIndex>(indexFile(workspaceId));
  if (!raw || !Array.isArray(raw.items)) return { items: [] };
  return { items: raw.items.filter((item) => item && typeof item.id === "string") };
}

function writeIndex(workspaceId: string, index: ProposalIndex): void {
  writeSecureJson(indexFile(workspaceId), index);
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function normalizePatchPath(raw: string): string {
  if (!raw || raw.includes("\0") || /[\r\n\t]/.test(raw) || raw.includes("\\")) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Unsafe patch path: ${JSON.stringify(raw)}`);
  }
  if (raw.startsWith('"') || raw.endsWith('"')) {
    throw new PatchProposalError(
      "UNSAFE_PATCH_PATH",
      "Quoted git paths are not supported by the proposal channel; use ordinary workspace-relative paths."
    );
  }
  if (path.posix.isAbsolute(raw)) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Absolute patch path is not allowed: ${raw}`);
  }
  const normalized = path.posix.normalize(raw);
  if (
    normalized !== raw ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Non-canonical patch path is not allowed: ${raw}`);
  }
  if (
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized === ".c2cignore" ||
    normalized === ".c2c.json" ||
    normalized === ".gitattributes" ||
    normalized === ".gitmodules"
  ) {
    throw new PatchProposalError(
      "UNSAFE_PATCH_PATH",
      `C2C/Git control files cannot be modified through patch proposals: ${normalized}`
    );
  }
  return normalized;
}

function pathFromDiffHeader(line: string): string {
  const prefix = "diff --git ";
  if (!line.startsWith(prefix)) {
    throw new PatchProposalError("INVALID_PATCH", "Each patch section must start with 'diff --git'.");
  }
  const rest = line.slice(prefix.length);
  if (!rest.startsWith("a/")) {
    throw new PatchProposalError("INVALID_PATCH", "Patch paths must use standard a/... and b/... git prefixes.");
  }
  const split = rest.lastIndexOf(" b/");
  if (split <= 2) {
    throw new PatchProposalError("INVALID_PATCH", "Could not parse the git diff path header.");
  }
  const left = normalizePatchPath(rest.slice(2, split));
  const right = normalizePatchPath(rest.slice(split + 3));
  if (left !== right) {
    throw new PatchProposalError(
      "INVALID_PATCH",
      "Rename/copy patches are not accepted by the safe proposal channel."
    );
  }
  return left;
}

function validateFileHeader(value: string, prefix: "a/" | "b/", target: string): boolean {
  if (value === "/dev/null") return true;
  if (!value.startsWith(prefix)) return false;
  return normalizePatchPath(value.slice(2)) === target;
}

function validateSection(section: string[], target: string): PatchFileOperation {
  if (section.some((line) => line === "GIT binary patch" || line.startsWith("Binary files "))) {
    throw new PatchProposalError("INVALID_PATCH", "Binary patches are not accepted.");
  }
  if (
    section.some(
      (line) =>
        line.startsWith("rename from ") ||
        line.startsWith("rename to ") ||
        line.startsWith("copy from ") ||
        line.startsWith("copy to ") ||
        line.startsWith("old mode ") ||
        line.startsWith("new mode ") ||
        line.includes(" 160000") ||
        line.startsWith("Subproject commit ")
    )
  ) {
    throw new PatchProposalError(
      "INVALID_PATCH",
      "Rename/copy, permission-only, and submodule patches are not accepted."
    );
  }

  const oldHeader = section.find((line) => line.startsWith("--- "));
  const newHeader = section.find((line) => line.startsWith("+++ "));
  if (!oldHeader || !newHeader) {
    throw new PatchProposalError("INVALID_PATCH", `Missing ---/+++ file headers for ${target}.`);
  }
  const oldPath = oldHeader.slice(4);
  const newPath = newHeader.slice(4);
  if (!validateFileHeader(oldPath, "a/", target) || !validateFileHeader(newPath, "b/", target)) {
    throw new PatchProposalError("INVALID_PATCH", `File headers do not match diff path ${target}.`);
  }
  if (oldPath === "/dev/null" && newPath === "/dev/null") {
    throw new PatchProposalError("INVALID_PATCH", "Both patch file headers cannot be /dev/null.");
  }
  if (!section.some((line) => line.startsWith("@@ "))) {
    throw new PatchProposalError("INVALID_PATCH", `Patch for ${target} has no unified-diff hunk.`);
  }
  if (oldPath === "/dev/null") return "create";
  if (newPath === "/dev/null") return "delete";
  return "modify";
}

function classifyPatchRisk(
  paths: string[],
  operations: { path: string; operation: PatchFileOperation }[]
): { risk: PatchProposalRisk; reasons: string[] } {
  const reasons = new Set<string>();
  const manifestNames = new Set([
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "poetry.lock",
    "Pipfile",
    "Pipfile.lock",
    "Cargo.toml",
    "Cargo.lock",
    "go.mod",
    "go.sum",
    "pom.xml",
    "composer.json",
    "composer.lock",
    "Gemfile",
    "Gemfile.lock",
    "Makefile",
  ]);

  if (operations.some((item) => item.operation === "delete")) {
    reasons.add("file deletion");
  }

  for (const target of paths) {
    const base = path.posix.basename(target);
    const baseLower = base.toLowerCase();
    const lower = target.toLowerCase();
    if (
      lower.startsWith(".github/workflows/") ||
      lower.startsWith(".circleci/") ||
      lower === ".gitlab-ci.yml" ||
      lower === "jenkinsfile" ||
      lower.startsWith("azure-pipelines")
    ) {
      reasons.add("CI/CD configuration");
    }
    if (
      lower.startsWith(".devcontainer/") ||
      lower === ".pre-commit-config.yaml" ||
      lower === "tox.ini" ||
      lower === "noxfile.py" ||
      lower === "conftest.py" ||
      /(^|\/)(jest|vitest|vite|webpack)\.config\./.test(lower) ||
      lower === ".vscode/tasks.json" ||
      lower === "dockerfile" ||
      lower.endsWith("/dockerfile") ||
      lower.startsWith("docker-compose.") ||
      lower.includes("/docker-compose.")
    ) {
      reasons.add("build/container execution configuration");
    }
    if (
      [...manifestNames].some((name) => name.toLowerCase() === baseLower) ||
      /^requirements([-.].*)?\.txt$/i.test(base) ||
      /^build\.gradle/i.test(base)
    ) {
      reasons.add("dependency/build manifest");
    }
    if (/\.(sh|bash|zsh|fish|ps1|bat|cmd)$/i.test(base)) {
      reasons.add("executable script");
    }
  }

  return {
    risk: reasons.size > 0 ? "approval-required" : "normal",
    reasons: [...reasons],
  };
}

function targetFingerprint(workspace: Workspace, requested: string): TargetFingerprint {
  if (workspace.ignoreRules.isNoise(requested) || workspace.ignoreRules.isNoise(requested + "/")) {
    throw new PatchProposalError(
      "UNSAFE_PATCH_PATH",
      `Generated/build/cache/noise paths cannot be modified through patch proposals: ${requested}`
    );
  }

  let resolved: { abs: string; rel: string };
  try {
    resolved = workspace.resolve(requested);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw new PatchProposalError("UNSAFE_PATCH_PATH", error.message);
    }
    throw error;
  }

  // If canonical resolution changed the requested path, a symlink was crossed.
  // Refuse it even when the symlink target is still inside the workspace.
  if (resolved.rel !== requested) {
    throw new PatchProposalError(
      "UNSAFE_PATCH_PATH",
      `Patch target must not traverse symlinks: ${requested}`
    );
  }

  const rawAbs = path.join(workspace.root, ...requested.split("/"));
  if (!fs.existsSync(rawAbs)) {
    return { path: requested, exists: false, sha256: null, sizeBytes: 0 };
  }
  const stat = fs.lstatSync(rawAbs);
  if (stat.isSymbolicLink()) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Patch target must not be a symlink: ${requested}`);
  }
  if (!stat.isFile()) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Patch target is not a regular file: ${requested}`);
  }
  if (stat.size > MAX_TARGET_BYTES) {
    throw new PatchProposalError(
      "UNSAFE_PATCH_PATH",
      `Patch target is too large for safe fingerprinting: ${requested}`
    );
  }
  const body = fs.readFileSync(rawAbs);
  if (body.subarray(0, Math.min(body.length, 8192)).includes(0)) {
    throw new PatchProposalError("UNSAFE_PATCH_PATH", `Patch target appears to be binary: ${requested}`);
  }
  return {
    path: requested,
    exists: true,
    sha256: sha256(body),
    sizeBytes: body.length,
  };
}

export function validatePatchProposal(
  workspace: Workspace,
  patch: string
): {
  paths: string[];
  operations: { path: string; operation: PatchFileOperation }[];
  baseFiles: TargetFingerprint[];
  sizeBytes: number;
  sha256: string;
} {
  const sizeBytes = utf8Bytes(patch);
  if (sizeBytes <= 0) {
    throw new PatchProposalError("INVALID_PATCH", "Patch body is empty.");
  }
  if (sizeBytes > MAX_PATCH_BYTES) {
    throw new PatchProposalError(
      "PATCH_TOO_LARGE",
      `Patch is ${sizeBytes} bytes; maximum is ${MAX_PATCH_BYTES} bytes.`
    );
  }
  if (patch.includes("\0")) {
    throw new PatchProposalError("INVALID_PATCH", "Patch contains a NUL byte.");
  }
  if (/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(patch)) {
    throw new PatchProposalError("INVALID_PATCH", "Patch contains unsafe control characters.");
  }

  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("diff --git ")) starts.push(i);
  }
  if (starts.length === 0) {
    throw new PatchProposalError("INVALID_PATCH", "Expected a standard git unified diff.");
  }
  if (starts.length > MAX_PATCH_FILES) {
    throw new PatchProposalError(
      "TOO_MANY_FILES",
      `Patch touches ${starts.length} files; maximum is ${MAX_PATCH_FILES}.`
    );
  }

  const paths: string[] = [];
  const operations: { path: string; operation: PatchFileOperation }[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < starts.length; n++) {
    const start = starts[n];
    const end = n + 1 < starts.length ? starts[n + 1] : lines.length;
    const section = lines.slice(start, end);
    const target = pathFromDiffHeader(section[0]);
    if (seen.has(target)) {
      throw new PatchProposalError("INVALID_PATCH", `Duplicate diff section for ${target}.`);
    }
    seen.add(target);
    const operation = validateSection(section, target);
    paths.push(target);
    operations.push({ path: target, operation });
  }

  const baseFiles = paths.map((target) => targetFingerprint(workspace, target));
  return { paths, operations, baseFiles, sizeBytes, sha256: sha256(patch) };
}

export function savePatchProposal(workspace: Workspace, input: SavePatchProposalInput): PatchProposalMeta {
  const taskId = input.taskId.trim();
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(taskId)) {
    throw new PatchProposalError("INVALID_PATCH", "task_id must be 1-80 safe identifier characters.");
  }
  if (!Number.isInteger(input.iteration) || input.iteration < 0 || input.iteration > 1000) {
    throw new PatchProposalError("INVALID_PATCH", "iteration must be an integer between 0 and 1000.");
  }
  const validated = validatePatchProposal(workspace, input.patch);
  const now = new Date().toISOString();
  const id = `p_${randomBytes(8).toString("hex")}`;
  const summary = input.summary?.trim();
  if (summary && utf8Bytes(summary) > 4096) {
    throw new PatchProposalError("INVALID_PATCH", "summary exceeds 4096 UTF-8 bytes.");
  }
  const risk = classifyPatchRisk(validated.paths, validated.operations);
  const meta: PatchProposalMeta = {
    id,
    taskId,
    iteration: input.iteration,
    summary: summary || undefined,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    sizeBytes: validated.sizeBytes,
    sha256: validated.sha256,
    fileCount: validated.paths.length,
    paths: validated.paths,
    operations: validated.operations,
    risk: risk.risk,
    riskReasons: risk.reasons,
    baseFiles: validated.baseFiles,
  };

  const index = readIndex(workspace.id);
  // Never evict an in-flight proposal. Reclaim terminal entries first; if the
  // model has filled the entire bounded store with pending proposals, reject
  // further submissions until Codex disposes of at least one.
  while (index.items.length >= MAX_PATCH_PROPOSALS) {
    const terminalIndex = index.items.findIndex((item) => item.status !== "pending");
    if (terminalIndex < 0) {
      throw new PatchProposalError(
        "PROPOSAL_LIMIT",
        `There are already ${MAX_PATCH_PROPOSALS} pending patch proposals for this workspace.`
      );
    }
    const [dropped] = index.items.splice(terminalIndex, 1);
    if (dropped) fs.rmSync(patchFile(workspace.id, dropped.id), { force: true });
  }

  const file = patchFile(workspace.id, id);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, input.patch, { mode: 0o600, flag: "wx" });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best effort on platforms without chmod semantics
  }

  index.items.push(meta);
  writeIndex(workspace.id, index);
  return meta;
}

function proposalById(workspaceId: string, id: string): PatchProposalMeta {
  if (!/^p_[a-f0-9]{16}$/.test(id)) {
    throw new PatchProposalError("PROPOSAL_NOT_FOUND", "Invalid proposal id.");
  }
  const found = readIndex(workspaceId).items.find((item) => item.id === id);
  if (!found) throw new PatchProposalError("PROPOSAL_NOT_FOUND", `No patch proposal with id ${id}.`);
  return found;
}

function stalePaths(workspace: Workspace, meta: PatchProposalMeta): string[] {
  const stale: string[] = [];
  for (const base of meta.baseFiles) {
    try {
      const current = targetFingerprint(workspace, base.path);
      if (
        current.exists !== base.exists ||
        current.sha256 !== base.sha256 ||
        current.sizeBytes !== base.sizeBytes
      ) {
        stale.push(base.path);
      }
    } catch {
      stale.push(base.path);
    }
  }
  return stale;
}

export function readPatchProposal(
  workspace: Workspace,
  id: string
): { meta: PatchProposalMeta; patch: string; stalePaths: string[]; stale: boolean } {
  const meta = proposalById(workspace.id, id);
  const file = patchFile(workspace.id, id);
  if (!fs.existsSync(file)) {
    throw new PatchProposalError("PROPOSAL_NOT_FOUND", `Patch body for ${id} is missing.`);
  }
  const patch = fs.readFileSync(file, "utf8");
  if (sha256(patch) !== meta.sha256 || utf8Bytes(patch) !== meta.sizeBytes) {
    throw new PatchProposalError("INVALID_PATCH", `Stored patch ${id} failed its integrity check.`);
  }
  const changed = stalePaths(workspace, meta);
  return { meta, patch, stalePaths: changed, stale: changed.length > 0 };
}

export function patchProposalBodyPath(workspaceId: string, id: string): string {
  proposalById(workspaceId, id);
  return patchFile(workspaceId, id);
}

export function listPatchProposals(workspaceId: string, limit = 20): PatchProposalMeta[] {
  const items = readIndex(workspaceId).items;
  return items.slice(-Math.max(1, Math.min(MAX_PATCH_PROPOSALS, Math.floor(limit))));
}

export function markPatchProposal(
  workspaceId: string,
  id: string,
  status: Exclude<PatchProposalStatus, "pending">
): PatchProposalMeta {
  const index = readIndex(workspaceId);
  const found = index.items.find((item) => item.id === id);
  if (!found) throw new PatchProposalError("PROPOSAL_NOT_FOUND", `No patch proposal with id ${id}.`);
  found.status = status;
  found.updatedAt = new Date().toISOString();
  writeIndex(workspaceId, index);
  return found;
}

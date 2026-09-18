import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../config/paths.js";

export const DEFAULT_PROPOSAL_AUTH_TTL_MINUTES = 240;
export const MAX_PROPOSAL_AUTH_TTL_MINUTES = 24 * 60;
export const MAX_ACTIVE_PROPOSAL_TASKS = 4;

export interface ProposalTaskAuthorization {
  taskId: string;
  authorizedAt: number;
  expiresAt: number;
}

interface ProposalAuthorizationState {
  tasks: ProposalTaskAuthorization[];
}

function authFile(workspaceId: string): string {
  return path.join(getStateDir(), "proposal-authorizations", `${workspaceId}.json`);
}

function validTaskId(taskId: string): boolean {
  return /^[A-Za-z0-9._-]{1,80}$/.test(taskId);
}

function readState(workspaceId: string): ProposalAuthorizationState {
  const raw = readJsonIfExists<ProposalAuthorizationState>(authFile(workspaceId));
  if (!raw || !Array.isArray(raw.tasks)) return { tasks: [] };
  const now = Date.now();
  const tasks = raw.tasks.filter(
    (item) =>
      item &&
      typeof item.taskId === "string" &&
      validTaskId(item.taskId) &&
      Number.isFinite(item.authorizedAt) &&
      Number.isFinite(item.expiresAt) &&
      item.expiresAt > now
  );
  return { tasks };
}

function writeState(workspaceId: string, state: ProposalAuthorizationState): void {
  writeSecureJson(authFile(workspaceId), state);
}

export function listAuthorizedProposalTasks(workspaceId: string): ProposalTaskAuthorization[] {
  const state = readState(workspaceId);
  // Persist pruning so expired capabilities do not accumulate on disk.
  writeState(workspaceId, state);
  return state.tasks;
}

export function authorizeProposalTask(
  workspaceId: string,
  taskIdInput: string,
  ttlMinutes = DEFAULT_PROPOSAL_AUTH_TTL_MINUTES
): ProposalTaskAuthorization {
  const taskId = taskIdInput.trim();
  if (!validTaskId(taskId)) {
    throw new Error("task id must be 1-80 alphanumeric/._- characters");
  }
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > MAX_PROPOSAL_AUTH_TTL_MINUTES) {
    throw new Error(`ttl-minutes must be between 1 and ${MAX_PROPOSAL_AUTH_TTL_MINUTES}`);
  }

  const state = readState(workspaceId);
  const now = Date.now();
  const existing = state.tasks.find((item) => item.taskId === taskId);
  const authorization: ProposalTaskAuthorization = {
    taskId,
    authorizedAt: existing?.authorizedAt ?? now,
    expiresAt: now + Math.floor(ttlMinutes * 60_000),
  };

  if (existing) {
    Object.assign(existing, authorization);
  } else {
    if (state.tasks.length >= MAX_ACTIVE_PROPOSAL_TASKS) {
      throw new Error(
        `There are already ${MAX_ACTIVE_PROPOSAL_TASKS} active coding-subagent task authorizations for this workspace.`
      );
    }
    state.tasks.push(authorization);
  }
  writeState(workspaceId, state);
  return authorization;
}

export function isProposalTaskAuthorized(workspaceId: string, taskId: string): boolean {
  if (!validTaskId(taskId)) return false;
  return readState(workspaceId).tasks.some((item) => item.taskId === taskId);
}

export function revokeProposalTask(
  workspaceId: string,
  taskId?: string
): { revoked: number; remaining: ProposalTaskAuthorization[] } {
  const state = readState(workspaceId);
  const before = state.tasks.length;
  state.tasks = taskId ? state.tasks.filter((item) => item.taskId !== taskId) : [];
  writeState(workspaceId, state);
  return { revoked: before - state.tasks.length, remaining: state.tasks };
}

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Workspace } from "../src/workspace/manager.js";
import {
  MAX_PATCH_BYTES,
  PatchProposalError,
  listPatchProposals,
  markPatchProposal,
  readPatchProposal,
  savePatchProposal,
} from "../src/proposal/store.js";
import { cleanup, isolateStateDir, makeTmpDir, write } from "./helpers.js";

function modifyPatch(target = "src/app.ts"): string {
  return [
    `diff --git a/${target} b/${target}`,
    "index 1111111..2222222 100644",
    `--- a/${target}`,
    `+++ b/${target}`,
    "@@ -1 +1 @@",
    "-export const value = 1;",
    "+export const value = 2;",
    "",
  ].join("\n");
}

describe("patch proposal store", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  function setup(): { root: string; workspace: Workspace } {
    dirs.push(isolateStateDir());
    const root = makeTmpDir("proposal-ws");
    dirs.push(root);
    write(root, "src/app.ts", "export const value = 1;\n");
    write(root, ".env", "SECRET=never\n");
    write(root, ".c2cignore", "private/\n");
    write(root, "private/note.ts", "export const secret = 1;\n");
    return { root, workspace: new Workspace(root) };
  }

  it("stores a valid proposal outside the workspace without modifying the target file", () => {
    const { root, workspace } = setup();
    const before = fs.readFileSync(path.join(root, "src/app.ts"), "utf8");

    const meta = savePatchProposal(workspace, {
      taskId: "c2c_test",
      iteration: 1,
      patch: modifyPatch(),
      summary: "Change value to 2",
    });

    expect(meta.status).toBe("pending");
    expect(meta.paths).toEqual(["src/app.ts"]);
    expect(meta.fileCount).toBe(1);
    expect(meta.risk).toBe("normal");
    expect(meta.riskReasons).toEqual([]);
    expect(fs.readFileSync(path.join(root, "src/app.ts"), "utf8")).toBe(before);
    expect(listPatchProposals(workspace.id)).toHaveLength(1);

    const saved = readPatchProposal(workspace, meta.id);
    expect(saved.patch).toBe(modifyPatch());
    expect(saved.stale).toBe(false);
    expect(saved.stalePaths).toEqual([]);
  });

  it("marks a proposal stale when a target changes after submission", () => {
    const { root, workspace } = setup();
    const meta = savePatchProposal(workspace, {
      taskId: "c2c_test",
      iteration: 1,
      patch: modifyPatch(),
    });

    write(root, "src/app.ts", "export const value = 99;\n");
    const saved = readPatchProposal(workspace, meta.id);
    expect(saved.stale).toBe(true);
    expect(saved.stalePaths).toEqual(["src/app.ts"]);
  });

  it("records disposition without applying the patch", () => {
    const { root, workspace } = setup();
    const before = fs.readFileSync(path.join(root, "src/app.ts"), "utf8");
    const meta = savePatchProposal(workspace, {
      taskId: "c2c_test",
      iteration: 1,
      patch: modifyPatch(),
    });

    const marked = markPatchProposal(workspace.id, meta.id, "applied");
    expect(marked.status).toBe("applied");
    expect(fs.readFileSync(path.join(root, "src/app.ts"), "utf8")).toBe(before);
  });

  it("flags execution-sensitive configuration for explicit approval", () => {
    const { workspace } = setup();
    const meta = savePatchProposal(workspace, {
      taskId: "c2c_risk",
      iteration: 1,
      patch: modifyPatch("package.json"),
    });
    expect(meta.risk).toBe("execution-sensitive");
    expect(meta.riskReasons).toContain("dependency/build manifest");
  });

  it("rejects sensitive and C2C control paths", () => {
    const { workspace } = setup();
    for (const target of [".env", ".c2cignore", ".c2c.json", "private/note.ts", ".git/config"]) {
      expect(() =>
        savePatchProposal(workspace, {
          taskId: "c2c_test",
          iteration: 1,
          patch: modifyPatch(target),
        })
      ).toThrow(PatchProposalError);
    }
  });

  it("rejects traversal, rename, binary, permission, and control-character patches", () => {
    const { workspace } = setup();

    const traversal = modifyPatch("../outside.ts");
    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch: traversal })
    ).toThrow(/path|canonical|outside/i);

    const rename = modifyPatch().replace(
      "diff --git a/src/app.ts b/src/app.ts",
      "diff --git a/src/app.ts b/src/renamed.ts"
    );
    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch: rename })
    ).toThrow(/rename|copy/i);

    const binary = modifyPatch() + "GIT binary patch\n";
    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch: binary })
    ).toThrow(/binary/i);

    const mode = modifyPatch().replace(
      "index 1111111..2222222 100644",
      "old mode 100644\nnew mode 100755"
    );
    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch: mode })
    ).toThrow(/permission|submodule|rename/i);

    const control = modifyPatch() + "\u001b[31m";
    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch: control })
    ).toThrow(/control/i);
  });

  it("rejects patches above the bounded proposal size", () => {
    const { workspace } = setup();
    const hugeLine = "+" + "x".repeat(MAX_PATCH_BYTES);
    const patch = [
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1 +1 @@",
      "-export const value = 1;",
      hugeLine,
      "",
    ].join("\n");

    expect(() =>
      savePatchProposal(workspace, { taskId: "c2c_test", iteration: 1, patch })
    ).toThrow(/maximum|bytes/i);
  });
});

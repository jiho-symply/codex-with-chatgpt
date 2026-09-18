import { afterEach, describe, expect, it } from "vitest";
import {
  authorizeProposalTask,
  isProposalTaskAuthorized,
  listAuthorizedProposalTasks,
  revokeProposalTask,
} from "../src/proposal/authorization.js";
import { cleanup, isolateStateDir } from "./helpers.js";

describe("patch proposal task authorization", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  function setup(): string {
    dirs.push(isolateStateDir());
    return "abc123abc123";
  }

  it("authorizes only the explicit task and can revoke it", () => {
    const workspaceId = setup();
    const auth = authorizeProposalTask(workspaceId, "c2c_123456789abc", 30);
    expect(auth.taskId).toBe("c2c_123456789abc");
    expect(isProposalTaskAuthorized(workspaceId, auth.taskId)).toBe(true);
    expect(isProposalTaskAuthorized(workspaceId, "c2c_other")).toBe(false);

    const revoked = revokeProposalTask(workspaceId, auth.taskId);
    expect(revoked.revoked).toBe(1);
    expect(isProposalTaskAuthorized(workspaceId, auth.taskId)).toBe(false);
  });

  it("renews an existing task without creating duplicates", () => {
    const workspaceId = setup();
    const first = authorizeProposalTask(workspaceId, "c2c_same", 10);
    const second = authorizeProposalTask(workspaceId, "c2c_same", 20);
    expect(second.authorizedAt).toBe(first.authorizedAt);
    expect(second.expiresAt).toBeGreaterThanOrEqual(first.expiresAt);
    expect(listAuthorizedProposalTasks(workspaceId)).toHaveLength(1);
  });

  it("bounds active coding task authorizations", () => {
    const workspaceId = setup();
    for (let i = 0; i < 4; i++) authorizeProposalTask(workspaceId, `c2c_task_${i}`, 30);
    expect(() => authorizeProposalTask(workspaceId, "c2c_task_4", 30)).toThrow(/already 4 active/i);
  });

  it("rejects invalid task ids and unsafe TTL values", () => {
    const workspaceId = setup();
    expect(() => authorizeProposalTask(workspaceId, "../bad", 30)).toThrow(/task id/i);
    expect(() => authorizeProposalTask(workspaceId, "c2c_ok", 0)).toThrow(/ttl-minutes/i);
    expect(() => authorizeProposalTask(workspaceId, "c2c_ok", 2000)).toThrow(/ttl-minutes/i);
  });
});

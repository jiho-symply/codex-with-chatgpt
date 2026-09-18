import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mergeUiPrefs,
  prefsFile,
  readUiPrefs,
  SETUP_CHOICE_PROMPT,
} from "../src/config/ui-prefs.js";
import { cleanup, isolateStateDir } from "./helpers.js";

describe("ui prefs", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  it("starts empty and is not bound to a workspace", () => {
    dirs.push(isolateStateDir());
    const prefs = readUiPrefs();
    expect(prefs.developerModeEnabled).toBe(false);
    expect(prefs.setupMode).toBeNull();
    expect(prefs.chatgptModel).toBeNull();
    expect(prefs.chatgptEffort).toBeNull();
    expect(prefs.remembered).toEqual({
      developerMode: false,
      setupMode: false,
      chatgptModel: false,
      chatgptEffort: false,
    });
    expect(prefs.setupChoicePrompt).toBe(SETUP_CHOICE_PROMPT);
    expect(prefs.setupChoicePrompt).toContain("AI 자동 설정(프리뷰)");
    expect(prefs.setupChoicePrompt).toContain("수동 안내 설정");
    expect(prefs.setupChoicePrompt).toContain("「1」 또는 「2」");
  });

  it("remembers developer mode as on only, never as off", () => {
    dirs.push(isolateStateDir());
    const saved = mergeUiPrefs({ developerModeEnabled: true });
    expect(saved.developerModeEnabled).toBe(true);
    const raw = JSON.parse(fs.readFileSync(prefsFile(), "utf8")) as { developerModeEnabled?: boolean };
    expect(raw.developerModeEnabled).toBe(true);
    expect(JSON.stringify(raw)).not.toMatch(/token|pairing|secret/i);
  });

  it("saves setup mode without dropping developer mode", () => {
    dirs.push(isolateStateDir());
    mergeUiPrefs({ developerModeEnabled: true });
    const next = mergeUiPrefs({ setupMode: "manual" });
    expect(next.developerModeEnabled).toBe(true);
    expect(next.setupMode).toBe("manual");
    const auto = mergeUiPrefs({ setupMode: "auto" });
    expect(auto.setupMode).toBe("auto");
    expect(auto.developerModeEnabled).toBe(true);
  });

  it("persists and clears ChatGPT model and effort preferences", () => {
    dirs.push(isolateStateDir());
    const saved = mergeUiPrefs({ chatgptModel: "GPT-5.6 Sol", chatgptEffort: "High" });
    expect(saved.chatgptModel).toBe("GPT-5.6 Sol");
    expect(saved.chatgptEffort).toBe("High");
    expect(saved.remembered.chatgptModel).toBe(true);
    expect(saved.remembered.chatgptEffort).toBe(true);

    const preserved = mergeUiPrefs({ setupMode: "manual" });
    expect(preserved.chatgptModel).toBe("GPT-5.6 Sol");
    expect(preserved.chatgptEffort).toBe("High");

    const cleared = mergeUiPrefs({ chatgptModel: null, chatgptEffort: null });
    expect(cleared.chatgptModel).toBeNull();
    expect(cleared.chatgptEffort).toBeNull();
    expect(cleared.remembered.chatgptModel).toBe(false);
    expect(cleared.remembered.chatgptEffort).toBe(false);
  });

  it("rejects an unknown setup mode", () => {
    dirs.push(isolateStateDir());
    expect(() => mergeUiPrefs({ setupMode: "browser" as "auto" })).toThrow(/setup-mode/);
    expect(readUiPrefs().setupMode).toBeNull();
  });

  it("ignores a hand-edited developerModeEnabled false", () => {
    dirs.push(isolateStateDir());
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(
      prefsFile(),
      JSON.stringify({ developerModeEnabled: false, setupMode: "auto", updatedAt: "2026-01-01T00:00:00.000Z" }),
      { mode: 0o600 }
    );
    expect(readUiPrefs().developerModeEnabled).toBe(false);
    expect(readUiPrefs().remembered.developerMode).toBe(false);
    expect(readUiPrefs().setupMode).toBe("auto");
  });
});

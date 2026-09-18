import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "./paths.js";

export type SetupMode = "auto" | "manual";

export const SETUP_MODES: readonly SetupMode[] = ["auto", "manual"];

/** Shown once, before the first ChatGPT connection on this machine. */
export const SETUP_CHOICE_PROMPT = [
  "首次连接 ChatGPT 前，请选择一种配置方式（选一次即可，之后默认沿用）：",
  "",
  "**1. AI 自动化配置（预览版）**",
  "由我在内置浏览器里完成全部设置，你只需在需要登录、验证码或二次确认时操作一次。",
  "优点：几乎不用自己点页面。",
  "缺点：步骤多，整体更慢；若自动设置连续两次无法完成，会改为「手动教学配置」。",
  "",
  "**2. 手动教学配置**",
  "我逐步告诉你打开哪个页面、填写哪几项，由你在浏览器里完成点击。",
  "优点：大约 3 分钟可以完成，过程可控、更稳定。",
  "缺点：需要你按提示操作，不能完全放手。",
  "",
  "请回复「1」或「2」。未说明时，不要自行开始配置。",
].join("\n");

interface StoredUiPrefs {
  developerModeEnabled?: boolean;
  setupMode?: SetupMode;
  /** Exact visible model label to select in ChatGPT. Missing = keep ChatGPT default. */
  chatgptModel?: string;
  updatedAt: string;
}

export interface UiPrefsView {
  developerModeEnabled: boolean;
  setupMode: SetupMode | null;
  chatgptModel: string | null;
  setupChoicePrompt: string;
  remembered: {
    developerMode: boolean;
    setupMode: boolean;
    chatgptModel: boolean;
  };
}

export function prefsFile(): string {
  return path.join(getStateDir(), "prefs.json");
}

function readStored(): StoredUiPrefs | null {
  const raw = readJsonIfExists<StoredUiPrefs>(prefsFile());
  if (!raw || typeof raw !== "object") return null;
  const setupMode = raw.setupMode === "auto" || raw.setupMode === "manual" ? raw.setupMode : undefined;
  const chatgptModel =
    typeof raw.chatgptModel === "string" && raw.chatgptModel.trim() ? raw.chatgptModel.trim() : undefined;
  return {
    developerModeEnabled: raw.developerModeEnabled === true,
    setupMode,
    chatgptModel,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function readUiPrefs(): UiPrefsView {
  const stored = readStored();
  const developerModeEnabled = stored?.developerModeEnabled === true;
  const setupMode = stored?.setupMode ?? null;
  const chatgptModel = stored?.chatgptModel ?? null;
  return {
    developerModeEnabled,
    setupMode,
    chatgptModel,
    setupChoicePrompt: SETUP_CHOICE_PROMPT,
    remembered: {
      developerMode: developerModeEnabled,
      setupMode: setupMode !== null,
      chatgptModel: chatgptModel !== null,
    },
  };
}

export interface UiPrefsPatch {
  developerModeEnabled?: true;
  setupMode?: SetupMode;
  /** null clears the preference and restores ChatGPT's default model behavior. */
  chatgptModel?: string | null;
}

export function mergeUiPrefs(patch: UiPrefsPatch): UiPrefsView {
  if (patch.setupMode !== undefined && !SETUP_MODES.includes(patch.setupMode)) {
    throw new Error(`setup-mode must be one of ${SETUP_MODES.join(", ")}`);
  }
  const previous = readStored();
  const setupMode = patch.setupMode ?? previous?.setupMode;
  const chatgptModel =
    patch.chatgptModel === undefined
      ? previous?.chatgptModel
      : patch.chatgptModel === null
        ? undefined
        : patch.chatgptModel.trim() || undefined;
  const stored: StoredUiPrefs = {
    updatedAt: new Date().toISOString(),
  };
  // Only persist "confirmed on". Never write false — that would skip the
  // Security page on a new ChatGPT account or a machine restore.
  if (patch.developerModeEnabled === true || previous?.developerModeEnabled === true) {
    stored.developerModeEnabled = true;
  }
  if (setupMode) stored.setupMode = setupMode;
  if (chatgptModel) stored.chatgptModel = chatgptModel;
  writeSecureJson(prefsFile(), stored);
  return readUiPrefs();
}

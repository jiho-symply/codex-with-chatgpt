import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "./paths.js";

export type SetupMode = "auto" | "manual";

export const SETUP_MODES: readonly SetupMode[] = ["auto", "manual"];

/** Shown once, before the first ChatGPT connection on this machine. */
export const SETUP_CHOICE_PROMPT = [
  "ChatGPT에 처음 연결하기 전에 설정 방식을 선택하세요. 한 번 선택하면 이후 기본값으로 사용합니다.",
  "",
  "**1. AI 자동 설정(프리뷰)**",
  "Codex가 내장 브라우저에서 설정을 진행합니다. 로그인, CAPTCHA, 2단계 인증 등 사용자 확인이 필요한 경우에만 요청합니다.",
  "장점: 직접 클릭할 일이 거의 없습니다.",
  "단점: 단계가 더 많고 느릴 수 있습니다. 같은 설정 단계가 두 번 실패하면 수동 안내 설정으로 전환합니다.",
  "",
  "**2. 수동 안내 설정**",
  "Codex가 열어야 할 페이지와 입력할 값을 순서대로 안내하고, 사용자가 직접 브라우저에서 클릭합니다.",
  "장점: 과정이 단순하고 안정적입니다.",
  "단점: 몇 단계는 직접 조작해야 합니다.",
  "",
  "「1」 또는 「2」로 답하세요. 선택 전에는 설정을 시작하지 않습니다.",
].join("\n");

interface StoredUiPrefs {
  developerModeEnabled?: boolean;
  setupMode?: SetupMode;
  /** Exact model-family label discovered from the signed-in ChatGPT web UI. */
  chatgptModel?: string;
  /** Exact reasoning/effort label available for the selected model. */
  chatgptEffort?: string;
  updatedAt: string;
}

export interface UiPrefsView {
  developerModeEnabled: boolean;
  setupMode: SetupMode | null;
  chatgptModel: string | null;
  chatgptEffort: string | null;
  setupChoicePrompt: string;
  remembered: {
    developerMode: boolean;
    setupMode: boolean;
    chatgptModel: boolean;
    chatgptEffort: boolean;
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
  const chatgptEffort =
    typeof raw.chatgptEffort === "string" && raw.chatgptEffort.trim() ? raw.chatgptEffort.trim() : undefined;
  return {
    developerModeEnabled: raw.developerModeEnabled === true,
    setupMode,
    chatgptModel,
    chatgptEffort,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function readUiPrefs(): UiPrefsView {
  const stored = readStored();
  const developerModeEnabled = stored?.developerModeEnabled === true;
  const setupMode = stored?.setupMode ?? null;
  const chatgptModel = stored?.chatgptModel ?? null;
  const chatgptEffort = stored?.chatgptEffort ?? null;
  return {
    developerModeEnabled,
    setupMode,
    chatgptModel,
    chatgptEffort,
    setupChoicePrompt: SETUP_CHOICE_PROMPT,
    remembered: {
      developerMode: developerModeEnabled,
      setupMode: setupMode !== null,
      chatgptModel: chatgptModel !== null,
      chatgptEffort: chatgptEffort !== null,
    },
  };
}

export interface UiPrefsPatch {
  developerModeEnabled?: true;
  setupMode?: SetupMode;
  /** null clears the model preference and restores ChatGPT's default behavior. */
  chatgptModel?: string | null;
  /** null clears the saved reasoning/effort preference. */
  chatgptEffort?: string | null;
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
  const chatgptEffort =
    patch.chatgptEffort === undefined
      ? previous?.chatgptEffort
      : patch.chatgptEffort === null
        ? undefined
        : patch.chatgptEffort.trim() || undefined;
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
  if (chatgptEffort) stored.chatgptEffort = chatgptEffort;
  writeSecureJson(prefsFile(), stored);
  return readUiPrefs();
}

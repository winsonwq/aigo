export const DEFAULT_MODEL_KEY = "ready2work.defaultModel";
export const FALLBACK_MODEL = "openrouter/minimax/minimax-m1";
export const KNOWN_BAD_DEFAULTS = new Set(["openai/gpt-5.2-chat-latest"]);

export const MODEL_OPTIONS = [
  { value: "openrouter/minimax/minimax-m1", label: "MiniMax M1" },
  { value: "openrouter/minimax/minimax-m2", label: "MiniMax M2" },
  { value: "openrouter/moonshotai/kimi-k2.5", label: "Kimi K2.5" },
  { value: "openrouter/z-ai/glm-4.5-air:free", label: "GLM-4.5-Air Free" },
  { value: "openai/gpt-5.2-chat-latest", label: "OpenAI GPT-5.2-chat（当前返回空）" },
];

export function normalizeModel(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value || KNOWN_BAD_DEFAULTS.has(value)) return FALLBACK_MODEL;
  return value;
}

export function readDefaultModel(): string {
  try {
    const normalized = normalizeModel(localStorage.getItem(DEFAULT_MODEL_KEY));
    localStorage.setItem(DEFAULT_MODEL_KEY, normalized);
    return normalized;
  } catch {
    return FALLBACK_MODEL;
  }
}

export function persistDefaultModel(value: string): string {
  const normalized = normalizeModel(value);
  try {
    localStorage.setItem(DEFAULT_MODEL_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  return normalized;
}

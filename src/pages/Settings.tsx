import { useEffect, useState } from "react";

const USE_SYNC_PROMPT_KEY = "ready2work.useSyncPrompt";
const DEBUG_MESSAGES_KEY = "ready2work.debugMessages";
const DEFAULT_MODEL_KEY = "ready2work.defaultModel";
const FALLBACK_MODEL = "openrouter/minimax/minimax-m1";
const KNOWN_BAD_DEFAULTS = new Set(["openai/gpt-5.2-chat-latest"]);

const MODEL_OPTIONS = [
  { value: "openrouter/minimax/minimax-m1", label: "MiniMax M1（已验证可用）" },
  { value: "openrouter/minimax/minimax-m2", label: "MiniMax M2（已验证可用）" },
  { value: "openrouter/moonshotai/kimi-k2.5", label: "Kimi K2.5（已验证可用）" },
  { value: "openrouter/z-ai/glm-4.5-air:free", label: "GLM-4.5-Air Free（已验证可用）" },
  { value: "openai/gpt-5.2-chat-latest", label: "OpenAI GPT-5.2-chat（当前返回空）" },
];

export function Settings() {
  const [useSyncPrompt, setUseSyncPrompt] = useState(false);
  const [debugMessages, setDebugMessages] = useState(false);
  const [defaultModel, setDefaultModel] = useState(FALLBACK_MODEL);
  const [customModel, setCustomModel] = useState("");

  useEffect(() => {
    try {
      setUseSyncPrompt(localStorage.getItem(USE_SYNC_PROMPT_KEY) !== "false");
      setDebugMessages(localStorage.getItem(DEBUG_MESSAGES_KEY) === "true");
      const model = localStorage.getItem(DEFAULT_MODEL_KEY)?.trim();
      const normalized = !model || KNOWN_BAD_DEFAULTS.has(model) ? FALLBACK_MODEL : model;
      localStorage.setItem(DEFAULT_MODEL_KEY, normalized);
      setDefaultModel(normalized);
      setCustomModel(normalized);
    } catch {
      setUseSyncPrompt(true);
      setDebugMessages(false);
      setDefaultModel(FALLBACK_MODEL);
      setCustomModel(FALLBACK_MODEL);
    }
  }, []);

  const handleSyncPromptChange = (checked: boolean) => {
    try {
      localStorage.setItem(USE_SYNC_PROMPT_KEY, String(checked));
      setUseSyncPrompt(checked);
    } catch {
      setUseSyncPrompt(false);
    }
  };

  const handleDebugMessagesChange = (checked: boolean) => {
    try {
      localStorage.setItem(DEBUG_MESSAGES_KEY, String(checked));
      setDebugMessages(checked);
    } catch {
      setDebugMessages(false);
    }
  };

  const handlePresetModelChange = (value: string) => {
    try {
      localStorage.setItem(DEFAULT_MODEL_KEY, value);
      setDefaultModel(value);
      setCustomModel(value);
    } catch {
      // ignore
    }
  };

  const handleSaveCustomModel = () => {
    const value = customModel.trim();
    if (!value.includes("/")) return;
    try {
      localStorage.setItem(DEFAULT_MODEL_KEY, value);
      setDefaultModel(value);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        设置
      </h1>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            默认模型
          </h2>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            预设（推荐）
          </label>
          <select
            value={defaultModel}
            onChange={(e) => handlePresetModelChange(e.target.value)}
            className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            自定义模型（格式：provider/model）
          </label>
          <div className="flex max-w-md gap-2">
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="如 openrouter/minimax/minimax-m1"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={handleSaveCustomModel}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              保存
            </button>
          </div>
          <p className="max-w-md text-xs text-zinc-500 dark:text-zinc-400">
            当前默认模型：
            <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-700">
              {defaultModel}
            </code>
            。发送消息时会显式携带该模型。
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={useSyncPrompt}
              onChange={(e) => handleSyncPromptChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            />
            <span className="text-sm text-zinc-800 dark:text-zinc-200">
              使用同步发送（等待完整回复）
            </span>
          </label>
          <p className="max-w-md text-xs text-zinc-500 dark:text-zinc-400">
            默认使用同步发送：调用
            <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-700">session.prompt()</code>
            阻塞直到 AI 回复并直接拿到返回内容，无需轮询。取消勾选则改为异步发送（仅有限次拉取，适合流式场景）。请确认 OpenCode 已配置 Provider/Model（如
            <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-700">opencode config</code>
            ）。
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={debugMessages}
              onChange={(e) => handleDebugMessagesChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            />
            <span className="text-sm text-zinc-800 dark:text-zinc-200">
              开启消息调试（控制台输出）
            </span>
          </label>
          <p className="max-w-md text-xs text-zinc-500 dark:text-zinc-400">
            勾选后，在浏览器开发者工具控制台会打印：消息列表 API 的原始响应、解析后的消息条数与角色、以及 SSE
            <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-700">message.part.updated</code>
            / session.idle 事件。用于排查「有发送记录但没有回复」时，是接口没返回 assistant 消息还是 SSE 未触发/格式不符。
          </p>
        </div>
      </div>
    </div>
  );
}

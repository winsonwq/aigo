import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_MODEL_KEY,
  FALLBACK_MODEL,
  MODEL_OPTIONS,
  KNOWN_BAD_DEFAULTS,
} from "@/config/models";

const USE_SYNC_PROMPT_KEY = "ready2work.useSyncPrompt";
const DEBUG_MESSAGES_KEY = "ready2work.debugMessages";

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
      <Card className="rounded-2xl border-zinc-200/90 bg-white/90 dark:border-zinc-800/90 dark:bg-zinc-950/85">
        <CardContent className="space-y-6 p-5">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            默认模型
          </h2>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            预设（推荐）
          </label>
          <Select
            value={defaultModel}
            onChange={(e) => handlePresetModelChange(e.target.value)}
            className="max-w-md"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            自定义模型（格式：provider/model）
          </label>
          <div className="flex max-w-md gap-2">
            <Input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="如 openrouter/minimax/minimax-m1"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="default"
              onClick={handleSaveCustomModel}
            >
              保存
            </Button>
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
            <Checkbox
              checked={useSyncPrompt}
              onChange={(e) => handleSyncPromptChange(e.target.checked)}
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
            <Checkbox
              checked={debugMessages}
              onChange={(e) => handleDebugMessagesChange(e.target.checked)}
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
        </CardContent>
      </Card>
    </div>
  );
}

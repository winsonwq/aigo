// LLM 相关类型定义

export interface LLMConfig {
  provider: "openai" | "anthropic" | "openrouter" | "local";
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMClient {
  invoke(prompt: string): Promise<string>;
  stream(prompt: string): AsyncIterable<string>;
}

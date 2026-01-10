// LLM 客户端封装

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { LLMConfig, LLMClient } from "./types";

export class LLMClientImpl implements LLMClient {
  private client: ChatOpenAI | ChatAnthropic;

  constructor(config: LLMConfig) {
    if (config.provider === "openai") {
      this.client = new ChatOpenAI({
        model: config.model,
        apiKey: config.apiKey,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens,
        configuration: config.baseURL
          ? {
              baseURL: config.baseURL,
            }
          : undefined,
      });
    } else if (config.provider === "openrouter") {
      // OpenRouter 使用 OpenAI 兼容的 API
      if (!config.apiKey) {
        throw new Error("API key is required for OpenRouter");
      }
      // OpenRouter 配置：使用 configuration 字段
      this.client = new ChatOpenAI({
        model: config.model,
        apiKey: config.apiKey,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens,
        configuration: {
          baseURL: config.baseURL || "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com/aigo",
            "X-Title": process.env.OPENROUTER_TITLE || "AIGO",
          },
        },
      });
    } else if (config.provider === "anthropic") {
      this.client = new ChatAnthropic({
        modelName: config.model,
        anthropicApiKey: config.apiKey,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens,
      });
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async invoke(prompt: string): Promise<string> {
    const response = await this.client.invoke(prompt);
    return response.content as string;
  }

  async *stream(prompt: string): AsyncIterable<string> {
    const stream = await this.client.stream(prompt);
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as string;
      }
    }
  }

  getClient() {
    return this.client;
  }
}

// 创建默认 LLM 客户端（优先使用 OpenRouter，如果没有则使用 OpenAI）
export function createDefaultLLMClient(): LLMClientImpl {
  // 优先使用 OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    return new LLMClientImpl({
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      apiKey: openRouterKey,
      temperature: 0.7,
    });
  }

  // 回退到 OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required");
  }

  return new LLMClientImpl({
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    apiKey,
    temperature: 0.7,
  });
}

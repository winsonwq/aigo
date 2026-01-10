// 直接测试 OpenRouter 配置

import { ChatOpenAI } from "@langchain/openai";

async function test() {
  const apiKey = "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";
  
  console.log("测试 OpenRouter 配置...");
  
  const llm = new ChatOpenAI({
    model: "openai/gpt-4o-mini",
    apiKey: apiKey,
    temperature: 0.7,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/aigo",
        "X-Title": "AIGO",
      },
    },
  });

  try {
    const response = await llm.invoke("你好");
    console.log("✓ 成功:", response.content);
  } catch (error) {
    console.error("✗ 失败:", error);
    if (error instanceof Error) {
      console.error("错误消息:", error.message);
    }
  }
}

test();

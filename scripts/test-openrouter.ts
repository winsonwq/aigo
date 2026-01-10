// 测试 OpenRouter 集成

import { createAgent } from "../lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";

async function test() {
  console.log("环境变量检查:");
  console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "已设置" : "未设置");
  console.log("OPENROUTER_MODEL:", process.env.OPENROUTER_MODEL || "未设置");

  try {
    const agent = createAgent(10);
    console.log("\n✓ Agent 创建成功");

    const initialState = {
      messages: [new HumanMessage("你好")],
    };

    console.log("开始调用 Agent...");
    const result = await agent.invoke(initialState);
    console.log("✓ Agent 调用成功");
    const lastMessage = result.messages[result.messages.length - 1];
    if (lastMessage && "content" in lastMessage) {
      console.log("AI 回复:", lastMessage.content);
    }
  } catch (error) {
    console.error("错误:", error);
    if (error instanceof Error) {
      console.error("错误消息:", error.message);
      if (error.stack) {
        console.error("错误堆栈:", error.stack.split("\n").slice(0, 5).join("\n"));
      }
    }
    process.exit(1);
  }
}

test();

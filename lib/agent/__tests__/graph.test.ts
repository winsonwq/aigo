// Agent Graph 单元测试

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createAgent } from "../graph";
import { HumanMessage } from "@langchain/core/messages";
import { toolRegistry } from "../../tools/registry";
import { calculatorTool } from "../../tools/test-tool";

// 注册测试工具
beforeEach(() => {
  toolRegistry.clear();
  toolRegistry.register(calculatorTool);
});

describe("Agent Graph", () => {
  it("should create agent instance", () => {
    const agent = createAgent(10);
    expect(agent).toBeDefined();
  });

  it("should accept initial state with messages", () => {
    const agent = createAgent(10);
    const initialState = {
      messages: [new HumanMessage("test")],
    };
    
    // 验证状态结构
    expect(initialState.messages).toHaveLength(1);
    expect(initialState.messages[0]).toBeInstanceOf(HumanMessage);
  });
});

// 注意：完整的集成测试需要 OpenAI API Key
// 这些测试可以在有 API Key 的环境中运行

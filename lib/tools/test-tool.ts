// 测试工具

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// 简单的计算工具（用于测试）
export const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Performs basic arithmetic operations. Use this tool to calculate numbers.",
  schema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("The operation to perform"),
    a: z.number().describe("The first number"),
    b: z.number().describe("The second number"),
  }),
  func: async ({ operation, a, b }) => {
    switch (operation) {
      case "add":
        return `${a} + ${b} = ${a + b}`;
      case "subtract":
        return `${a} - ${b} = ${a - b}`;
      case "multiply":
        return `${a} × ${b} = ${a * b}`;
      case "divide":
        if (b === 0) {
          return "Error: Division by zero";
        }
        return `${a} ÷ ${b} = ${a / b}`;
    }
  },
});

// 测试工具单元测试

import { describe, it, expect } from "@jest/globals";
import { calculatorTool } from "../test-tool";

describe("Calculator Tool", () => {
  it("should add numbers correctly", async () => {
    const result = await calculatorTool.invoke({
      operation: "add",
      a: 10,
      b: 20,
    });
    expect(result).toBe("10 + 20 = 30");
  });

  it("should subtract numbers correctly", async () => {
    const result = await calculatorTool.invoke({
      operation: "subtract",
      a: 30,
      b: 10,
    });
    expect(result).toBe("30 - 10 = 20");
  });

  it("should multiply numbers correctly", async () => {
    const result = await calculatorTool.invoke({
      operation: "multiply",
      a: 5,
      b: 6,
    });
    expect(result).toBe("5 × 6 = 30");
  });

  it("should divide numbers correctly", async () => {
    const result = await calculatorTool.invoke({
      operation: "divide",
      a: 20,
      b: 4,
    });
    expect(result).toBe("20 ÷ 4 = 5");
  });

  it("should handle division by zero", async () => {
    const result = await calculatorTool.invoke({
      operation: "divide",
      a: 10,
      b: 0,
    });
    expect(result).toBe("Error: Division by zero");
  });
});

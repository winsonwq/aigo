/**
 * 工具调用渲染入口：从 tool-renderers 统一导出，保证 Session 等处的 import 路径不变。
 */
export {
  renderToolPart,
  renderToolSegment,
  groupConsecutiveToolParts,
  getSubagentCommand,
  getSubagentOutput,
  type ToolPart,
  type ToolRenderContext,
  type ToolGroupKind,
} from "./tool-renderers";

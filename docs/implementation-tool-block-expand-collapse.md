# Tool 块展开/收起与摘要展示（实现说明）

本文档说明 tool 块「非完成展开、完成自动收起」及 Bash 摘要展示的约定与最佳实践对照。

---

## 1. 已遵循的实践

### 1.1 React 与组件（见 implementation.md §3）

- **Hooks 命名**：`useExpandedWithAutoCollapse` 以 `use` 开头，符合约定。
- **状态与副作用**：展开状态用 `useState`，「完成时收起 / 进行中时展开」用 `useEffect` 响应 `defaultOpen`、`isCompleted`，不在渲染路径中产生副作用。
- **组件职责**：各 ToolBlock 只负责自身展示与摘要逻辑，hook 只负责「展开 + 自动收放」这一块逻辑，职责清晰。

### 1.2 TypeScript（见 implementation.md §2）

- Hook 参数与返回值均有明确类型；`setExpanded` 类型与 `useState` 的 setter 一致。
- Bash 块中 `description` / `summaryText` 的推导均基于已有 `part.state` 类型，无 `any`。

### 1.3 复用与 DRY

- 公共逻辑抽成 `useExpandedWithAutoCollapse`，所有 ToolBlock（含 Question、分组块）统一使用，避免在各处重复「完成时 setExpanded(false)」。
- Bash 的「描述」与「运行中显示命令、已运行显示描述」集中在一处，便于后续改文案或规则。

### 1.4 Hook 放置位置

- 实现规范建议：**共享 hooks 放在 `src/hooks/`**。
- 本 hook 仅被 `src/components/tool-renderers/` 内组件使用，属于「功能内共享」，故放在 `tool-renderers/useExpandedWithAutoCollapse.ts`，与调用方同目录，便于内聚与阅读。若未来被其他模块使用，再迁至 `src/hooks/` 更合适。

---

## 2. 本次小改进

### 2.1 与「进行中即展开」一致

- **原行为**：仅在「完成」时通过 `useEffect` 收起；若同一 block 从完成再次变为进行中（如重试），`defaultOpen` 会变回 `true`，但 `expanded` 仍为 `false`，不会自动再展开。
- **现行为**：在 `useEffect` 中同时响应 `defaultOpen` 与 `isCompleted`：`isCompleted` 时收起，`!isCompleted && defaultOpen` 时展开。这样「非完成状态下默认展开」在状态从完成回到进行中时也成立，与设计一致。

---

## 3. BashToolBlock 摘要逻辑（简要）

- **运行中**：摘要优先显示「运行 &lt;命令&gt;」（命令过长截断）；无命令时用描述（`title` 或「执行 shell 命令」）。
- **已运行**：摘要一律显示描述（`part.state.title` 或「执行 shell 命令」），不显示命令；展开后内容区仍展示完整命令与输出。

逻辑集中在组件内、依赖 `isCalling` 与 `description`，可读性好；若以后多种 tool 需要类似「按状态切换摘要内容」，可再抽成小工具函数。

---

## 4. 小结

- 当前实现符合项目的 React/TS 与目录约定，复用和职责划分合理。
- 通过让 hook 同时响应 `defaultOpen` 与 `isCompleted`，使「非完成展开、完成收起」在状态来回切换时也保持一致，更符合最佳实践。

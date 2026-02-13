# 从 OpenWork 可参考的基础功能与 OpenCode 使用方式

本文档整理 [different-ai/openwork](https://github.com/different-ai/openwork) 中与 **OpenCode 客户端使用** 及基础功能相关的、可供 AIGO 参考的部分。

---

## 1. OpenWork 与 OpenCode 的三种通信方式

OpenWork 通过 **opencode-bridge** 与 OpenCode 运行时通信，采用三种方式（可选择性借鉴）：

| 方式               | 用途                               | 说明                                                                                                                                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **HTTP API + SDK** | 会话 CRUD、发消息、健康检查        | 使用 `@opencode-ai/sdk` 的 `createOpencodeClient({ baseUrl })`，调用服务端 REST API。                                                                                    |
| **SQLite 直读**    | 会话列表、消息历史、元数据         | 直接读取 OpenCode 的数据库 `~/.opencode/opencode.db`（或项目内 `.opencode/opencode.db`），表包括 `sessions`、`messages`（含 `parts` JSON）。适合做列表、搜索、离线展示。 |
| **MCP Bridge**     | 实时权限弹窗、流式进度、自定义工具 | OpenWork 作为 MCP 服务被 OpenCode 连接；用于权限确认、流式推送、暴露原生能力（如文件选择器）。                                                                           |

- **AIGO 建议**：优先用 **SDK + HTTP API** 实现会话/消息与事件流；若需要与 OpenWork 一致的列表性能或离线能力，再考虑 **SQLite 直读**；若需要权限确认、自定义工具再考虑 **MCP Bridge**。

---

## 2. OpenCode 服务端 API（SDK 对应能力）

以下为 OpenCode Server 暴露的常用能力，SDK 提供类型安全的封装：

- **会话**
  - `GET /session` → 列表
  - `POST /session` → 创建
  - `GET /session/{id}` → 单会话详情
- **消息**
  - `POST /session/{id}/message` → 发送 prompt（**同步阻塞**，直到 AI 回复结束）
  - `GET /session/{id}/message` → 该会话下消息列表
- **事件流（SSE）**
  - `GET /global/event` → 全局事件流
  - 使用 **`client.event.subscribe()`** 订阅 SSE，可收到如 `message.part.updated` 等流式事件，用于实时更新 UI。

**AIGO 推荐**：默认使用 **同步** `client.session.prompt()`：该调用会阻塞直到 AI 回复完成，并**直接返回** `{ info: AssistantMessage, parts }`，前端用返回值即可展示回复，无需轮询或 SSE。流式场景可选用异步 `promptAsync` + 有限次拉取或 SSE。

---

## 3. 文件与 Artifacts（Session 内产出/修改文件列表）

会话中「产出的、被修改的文件」可从以下来源聚合，用于在 UI 中展示 **Session Artifacts** 列表：

- **工具调用**：OpenCode 内置文件类工具有 `edit`（精确替换）、`write`（新建或覆盖）、`patch`（补丁）。在 `tool.execute.before` / `tool.execute.after` 或消息的 tool 类 part 中可拿到工具名与参数（含文件路径），按 session 汇总即可得到「本会话涉及的文件」及操作类型（新建/修改）。
- **文件事件**（若 SDK/服务端暴露）：如 `file.edited`、`file.watcher.updated` 等，按 `sessionID` 过滤后也可作为补充来源。

**UI 建议**：在会话详情页提供「Artifacts」面板或列表，每项包含：文件路径、操作类型（新建/修改）、可选时间或顺序；支持点击打开文件或定位到行（若与编辑器集成）。

---

## 4. OpenCode SQLite 结构（可选参考）

若采用「读库」方式补充会话/消息列表：

- **库路径**：`~/.opencode/opencode.db` 或 项目内 `.opencode/opencode.db`。
- **sessions 表**：`id`, `parent_session_id`, `title`, `message_count`, token 使用、cost、时间戳等。
- **messages 表**：`id`, `session_id`, `role`（user/assistant/tool）, `parts`（JSON 数组）, `model`, 时间戳等。

通过 Tauri 或 Node 层读 SQLite，可做会话列表、分页、搜索，与 OpenWork 行为一致。

---

## 5. OpenWork 桌面端已实现的基础功能（可对照实现）

以下为 OpenWork 已具备、可在 AIGO 中按需实现的能力：

- **Host / Client 模式**：本地启动 `opencode serve`（Host）或连接远程 OpenCode URL（Client）。
- **会话**：创建、列表、切换、删除；发 prompt，收回复。
- **实时流式**：通过 SSE / `event.subscribe()` 做 live streaming 展示。
- **执行计划 / Todos**：将 OpenCode 的 todos 渲染为时间线（execution plan）。
- **权限**：在 UI 中展示并处理 OpenCode 的权限请求（通过 MCP 或事件）。
- **模板**：保存并复用小工作流（prompt 模板）。
- **Skills 管理**：列表展示、从包安装、导入本地目录（AIGO 已规划 + zip 安装）。

---

## 6. OpenCode Client 使用要点小结

- **创建客户端**：`createOpencodeClient({ baseUrl: "http://127.0.0.1:<port>" })`（连接已有 serve）。
- **会话**：`client.session.create()` / `client.session.get()` / 列表接口（若 SDK 暴露或直接调 `GET /session`）。
- **发消息**：`client.session.prompt(sessionId, prompt)`（同步）；流式需配合 `client.event.subscribe()`。
- **事件订阅**：`client.event.subscribe()` → 处理 `message.part.updated`、工具调用、会话状态等。
- **健康检查**：`client.global.health()` 用于轮询与断线重连判断。

官方文档：[OpenCode Server](https://opencode.ai/docs/server/)、[OpenCode SDK](https://opencode.ai/docs/sdk/)。

---

## 7. 参考链接

- [different-ai/openwork](https://github.com/different-ai/openwork)
- [opencode-bridge 说明](https://agentskills.in/marketplace/%40different-ai%2Fopencode-bridge)（CLI + DB + MCP 三种方式）
- [OpenCode Server API](https://opencode.ai/docs/server/)
- [OpenCode SDK](https://opencode.ai/docs/sdk/)

---

## 8. OpenWork UI 与交互参考（对话、工具、Skills）

实现对话界面、工具调用展示、Skills 加载时可参考 OpenWork 的以下模块（[packages/app](https://github.com/different-ai/openwork/tree/dev/packages/app) 为 SolidJS）：

| 模块 | 路径 | 说明 |
|------|------|------|
| **Part 渲染** | `components/part-view.tsx` | 统一渲染 message part：text（Markdown/throttle）、tool（状态、input/output、diff、diagnostics、图片）、file、reasoning、step-start/step-finish。工具展示含 title、status、可展开 output、错误、diff 高亮。 |
| **会话布局** | `components/session/` | `composer.tsx` 输入与发送；`message-list.tsx` 消息列表与滚动；`context-panel.tsx` 右侧上下文；`touched-files-panel.tsx` 本会话涉及文件（Artifacts）；`sidebar.tsx` 会话侧栏。 |
| **思考/状态** | `components/thinking-block.tsx` | 推理中或长文本时的「Thinking」占位展示。 |
| **Skills** | 数据来自 `client.app.skills()` | 服务端聚合各路径下 SKILL.md，返回 `{ name, description, location, content }[]`。OpenWork 有 Skills Manager 列表与安装入口。 |

交互上可参考 **Claude Code**（流式、步骤感、任务列表）、**MiniMax Agent**（多轮工具链、状态清晰）：输入区固定底部、消息区滚动、工具调用以时间线/步骤展示、发送中显示「思考中」或加载态。

---

## 9. 阶段 2 调研结论：OpenCode 内置/下载与 sidecar（AIGO）

- **OpenWork 现状**（[Issue #121](https://github.com/different-ai/openwork/issues/121)）：OpenWork 默认从 PATH 启动 OpenCode，**不打包 sidecar**（release 无 `externalBin`）；`engine_install` 仅支持 macOS/Linux（curl \| bash），Windows 显式返回「不支持」。用户需自行安装 CLI，易出现「CLI not found」「serve unavailable」「exited immediately」等问题。
- **OpenCode CLI 获取方式**：官方未提供「单文件 CLI 二进制」直接下载页。安装方式为：`curl -fsSL https://opencode.ai/install | bash`、`npm i -g opencode-ai`、`brew install anomalyco/tap/opencode` 等；桌面版 DMG/安装包见 [opencode.ai/download](https://opencode.ai/download)，为桌面应用而非 CLI。
- **AIGO 当前策略**：从本机 **PATH** 启动 `opencode serve`；若未安装则提示用户安装（如 `brew install opencode`）。**后续可做**：解析官方 install 脚本得到各平台二进制 URL，或使用固定版本号 + GitHub Releases（若 OpenCode 提供 CLI 独立包），实现「下载到应用目录 → 从应用目录 spawn」；需运行时根据 OS/arch 选择对应构建（已预留 Tauri 侧 `get_platform` 命令）。

---

## 10. 若无回复的排查步骤

发送消息后若一直处于「思考中」或始终没有 AI 回复，可按以下顺序排查：

1. **确认 OpenCode 已配置 Provider/Model**  
   在终端执行 `opencode config` 或查看 OpenCode 文档，确保已配置可用的模型（如 Claude、GPT 等）。未配置时服务端可能不返回内容或返回空。

2. **尝试「使用同步发送」**  
   在 AIGO **设置** 中勾选「使用同步发送（等待完整回复）」。此时会调用同步接口 `POST /session/:id/message` 并阻塞直到收到完整回复。若同步能拿到回复而异步没有，多半是 SSE/事件流或 `prompt_async` 路径问题；若同步也没有回复，则更可能是服务端配置或模型问题。

3. **工作区目录（directory）**  
   若 OpenCode 服务端要求项目上下文，可能需要在请求中传入 `directory`。当前实现未传 directory；若官方文档或服务端要求该参数，可在设置中增加「工作区目录」选项，并在 `prompt` / `promptAsync`、`messages` 等调用中传入。

4. **网络与控制台**  
   检查 Tauri 开发工具或浏览器控制台是否有请求失败、CORS 或 4xx/5xx；确认连接地址（如 `http://127.0.0.1:<port>`）与 OpenCode 实际 serve 端口一致。

5. **开发调试**  
   - **控制台位置**：若用 `pnpm tauri dev` 跑的是 Tauri 桌面窗口，必须在**应用窗口**上打开开发者工具（在窗口内右键 →「检查」/ Inspect，或菜单/快捷键），在**该窗口**的 Console 里看日志；浏览器里另开的标签页或终端的控制台都看不到应用内的 `console.log`。
   - 进入任意会话页时，控制台**一定会**出现一行 `[aigo] useSessionMessages mounted, sessionId: xxx`。若这行都没有，说明看的不是当前应用窗口的 Console。
   - 在 **设置** 中勾选「开启消息调试」，或在地址栏加 `?debug=1`（如 `http://localhost:5173/?debug=1#/session/xxx`）后，Console 会看到：
     - `[aigo:messages]`：拉取消息列表 API 的原始响应、normalize 后的条数、解析后的消息角色列表（user/assistant）。若这里只有 user 没有 assistant，说明服务端 GET message 未返回回复。
     - `[aigo:sse]`：SSE 事件类型与 properties。若发送后没有任何 `message.part.updated`，说明事件流未推送或未订阅到；若有事件但 sessionID 与当前会话不一致，可能是过滤逻辑问题（已做修复：无 sessionID 时按当前会话处理）。
   - 可根据上述日志判断问题在「接口未返回 assistant」还是「SSE 未触发/被过滤」。

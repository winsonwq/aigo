# 从 OpenWork 可参考的基础功能与 OpenCode 使用方式

本文档整理 [different-ai/openwork](https://github.com/different-ai/openwork) 中与 **OpenCode 客户端使用** 及基础功能相关的、可供 ready2work 参考的部分。

---

## 1. OpenWork 与 OpenCode 的三种通信方式

OpenWork 通过 **opencode-bridge** 与 OpenCode 运行时通信，采用三种方式（可选择性借鉴）：

| 方式               | 用途                               | 说明                                                                                                                                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **HTTP API + SDK** | 会话 CRUD、发消息、健康检查        | 使用 `@opencode-ai/sdk` 的 `createOpencodeClient({ baseUrl })`，调用服务端 REST API。                                                                                    |
| **SQLite 直读**    | 会话列表、消息历史、元数据         | 直接读取 OpenCode 的数据库 `~/.opencode/opencode.db`（或项目内 `.opencode/opencode.db`），表包括 `sessions`、`messages`（含 `parts` JSON）。适合做列表、搜索、离线展示。 |
| **MCP Bridge**     | 实时权限弹窗、流式进度、自定义工具 | OpenWork 作为 MCP 服务被 OpenCode 连接；用于权限确认、流式推送、暴露原生能力（如文件选择器）。                                                                           |

- **ready2work 建议**：优先用 **SDK + HTTP API** 实现会话/消息与事件流；若需要与 OpenWork 一致的列表性能或离线能力，再考虑 **SQLite 直读**；若需要权限确认、自定义工具再考虑 **MCP Bridge**。

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

**流式对话推荐顺序**：先 `client.event.subscribe()`，再 `client.session.prompt()`，在订阅回调里按 `sessionID` 过滤并处理 `message.part.updated` 等事件。

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

以下为 OpenWork 已具备、可在 ready2work 中按需实现的能力：

- **Host / Client 模式**：本地启动 `opencode serve`（Host）或连接远程 OpenCode URL（Client）。
- **会话**：创建、列表、切换、删除；发 prompt，收回复。
- **实时流式**：通过 SSE / `event.subscribe()` 做 live streaming 展示。
- **执行计划 / Todos**：将 OpenCode 的 todos 渲染为时间线（execution plan）。
- **权限**：在 UI 中展示并处理 OpenCode 的权限请求（通过 MCP 或事件）。
- **模板**：保存并复用小工作流（prompt 模板）。
- **Skills 管理**：列表展示、从包安装、导入本地目录（ready2work 已规划 + zip 安装）。

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

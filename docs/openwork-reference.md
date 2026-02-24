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

## 5.1 OpenCode 工具执行的授权机制（写文件等为何「没法交互」）

当 OpenCode 要执行需要用户批准的操作（如 **write** 新建/覆盖文件、**edit** 修改文件、**bash** 执行命令）时，行为由 **opencode.json** 的 `permission` 配置决定：

- **`allow`**：直接执行，无需交互。
- **`ask`**：先请求用户批准，再执行或拒绝。
- **`deny`**：直接拒绝，不执行。

默认不少操作是 `allow`；若你或项目里把 `edit`/`write` 等配成了 **`ask`**，则：

1. OpenCode 服务端会暂停执行，并通过 **SSE 全局事件** 发出 **`permission.asked`** 事件。
2. 事件 payload 为 **PermissionRequest**：含 `id`、`sessionID`、`permission`（如 `"edit"`/`"write"`）、`patterns`、`always`（建议「始终允许」的规则）、以及可选的 `tool: { messageID, callID }`。
3. 用户（或客户端）需要调用服务端 API 回复这次请求，可选值：
   - **`once`**：仅批准这一次。
   - **`always`**：批准并记住匹配的规则（本会话后续同类请求自动通过）。
   - **`reject`**：拒绝。

**当前 AIGO 的情况**：应用只通过 `client.event.subscribe()` 处理了 `message.part.updated` 和 `session.idle`，**没有监听 `permission.asked`**，也没有任何「权限确认」的 UI 或调用回复接口。因此当 OpenCode 侧配置为 `ask` 时，服务端会一直等待回复，界面上就会表现为「卡住、没法交互」。

**实现「可交互」的两种方向**：

| 方式 | 说明 |
|------|------|
| **在 AIGO 内实现权限弹窗** | 在现有 SSE 订阅里增加对 `permission.asked` 的处理；收到后在前端弹出对话框（工具名、路径/参数、once/always/reject）；用户选择后调用 **`POST /session/:id/permissions/:permissionID`**（body: `{ response: "once"\|"always"\|"reject" }`），或 SDK 中等价的 `client.session(sessionID).permissions(permissionID).respond(...)`。这样无需 MCP，即可在桌面端完成授权交互。 |
| **MCP Bridge（如 OpenWork）** | OpenWork 作为 MCP 服务被 OpenCode 连接，由 MCP 通道把「需要批准」的请求推到桌面 UI，再通过 MCP 回复。适合需要与 OpenWork 一致架构或复用其权限 UI 时采用；实现量较大。 |

**临时绕过**：若不需要在 AIGO 里点「批准」，可在 OpenCode 工作区或全局的 **opencode.json** 里把对应权限设为 `allow`（例如 `"permission": { "edit": "allow", "write": "allow" }`），写文件将不再等待用户确认，但会失去「每次确认」的安全控制。

**参考**：OpenCode 文档 [Permissions](https://opencode.ai/docs/permissions/)、Server API 中的 `POST /session/:id/permissions/:permissionID`；SDK 类型 `EventPermissionAsked`、`PermissionRequest`、`PermissionRespondData`。

---

## 5.2 会话标题（Session Title）自动更新（类似 OpenCode CLI）

OpenCode 服务端具备**会话标题自动更新**能力：在用户发送首条消息并得到 AI 回复后，会根据对话内容自动生成/更新会话标题，行为与 OpenCode CLI / TUI 一致。

- **服务端 API**  
  - `POST /session` 创建会话时，body 为 `{ parentID?, title? }`，**title 为可选**。可不传或传默认占位（如「新会话」），由服务端在首轮回复后自动更新。  
  - `PATCH /session/:id` 可更新会话属性，body 为 `{ title? }`；通常由服务端在 summarize/首条回复后自动调用。  
  - `GET /session/:id` 或 `session.list()` 返回的会话对象中包含最新 `title`。

- **自动标题行为**  
  - 依赖模型：Claude 系列、Grok 等会可靠地设置标题；部分模型可能不写 title（参见 [anomalyco/opencode#6819](https://github.com/anomalyco/opencode/issues/6819)）。  
  - 1.1.2 起已修复「标题不更新」的回归；若需更稳定，可选用社区插件 [opencode-smart-title](https://github.com/Tarquinen/opencode-smart-title)。

- **客户端实现建议**  
  1. **新建会话**：不引导用户输入标题，直接 `client.session.create({ body: { title: "新会话" } })`（或省略 title），创建后跳转到 `/session/:id`，与 CLI 体验一致。  
  2. **展示标题**：进入会话页时用 `client.session.get({ sessionID })` 取详情中的 `title`；侧栏列表使用 `session.list()` 的 `title`（已有 15s 轮询时可看到更新）。  
  3. **及时刷新**：在 SSE 收到 **`session.idle`**（本轮回复结束）时，对该会话调用 `session.get()` 或 `refetch` 会话列表，以便侧栏和页面标题立即显示服务端更新后的 title，无需等下一次轮询。

- **SSE 事件**：当前文档未明确列出 `session.updated` 事件；通过 **`session.idle`** 可知「本轮结束」，在此刻拉取会话详情或列表即可拿到最新 title。

---

## 6. OpenCode Client 使用要点小结

- **创建客户端**：`createOpencodeClient({ baseUrl: "http://127.0.0.1:<port>" })`（连接已有 serve）。
- **会话**：`client.session.create()` / `client.session.get()` / 列表接口（若 SDK 暴露或直接调 `GET /session`）。
- **发消息**：`client.session.prompt(sessionId, prompt)`（同步）；流式需配合 `client.event.subscribe()`。
- **事件订阅**：`client.event.subscribe()` → 处理 `message.part.updated`、`session.idle`、工具调用、会话状态等；在 `session.idle` 时拉取会话详情可拿到服务端自动更新后的 title（见 5.2）。
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

## 9. OpenCode 内置/下载与 sidecar：AIGO 与 OpenWork 对齐情况

### 9.1 OpenWork 当前机制（dev 分支）

- **打包**：`tauri.conf.json` 中 `bundle.externalBin` 包含 `sidecars/opencode`，release 会随应用一起分发 OpenCode CLI。
- **构建前**：`beforeBuildCommand` 执行 `prepare:sidecar`（`node scripts/prepare-sidecar.mjs`）再构建 UI；该脚本从 GitHub Releases 下载当前平台 OpenCode 到 `packages/desktop/src-tauri/sidecars/`，命名 `opencode-<target-triple>`。
- **版本**：`package.json` 的 `opencodeVersion`（如 1.2.6）或环境变量 `OPENCODE_VERSION`；支持用 GitHub API 拉取 latest。
- **资源映射**：与 [anomalyco/opencode](https://github.com/anomalyco/opencode) 发布物一致：darwin-arm64、darwin-x64-baseline、linux-x64-baseline、linux-arm64、windows-x64-baseline、windows-arm64 等。
- **运行时**：优先用 sidecar 启动 `opencode serve`，无 sidecar 时回退到 PATH（[Issue #121](https://github.com/different-ai/openwork/issues/121) 提出的方案已落地）。

### 9.2 AIGO 当前机制（与 OpenWork 对齐）

- **打包**：`bundle.externalBin` 包含 `binaries/opencode`，构建前执行 `node scripts/download-opencode.mjs`，将 OpenCode 下载到 `src-tauri/binaries/`，命名 `opencode-<target-triple>`。
- **版本**：优先顺序为 CLI 参数 → 环境变量 `OPENCODE_VERSION` → `package.json` 的 `opencodeVersion` → 默认 1.2.10；支持传 `latest` 从 GitHub API 取最新版。
- **资源映射**：与 OpenWork 一致（同一套 target triple → asset 表），x64 使用 baseline 以兼容无 AVX2 的机器；支持 aarch64-apple-darwin、x86_64-apple-darwin、x86_64/aarch64-unknown-linux-gnu、x86_64/aarch64-pc-windows-msvc。
- **运行时**：Rust 端 `start_opencode_serve` 优先 `app.shell().sidecar("opencode")`，失败则回退到 PATH 及常见安装路径（含 login shell 的 PATH），与 OpenWork「先 sidecar 再 PATH」一致。

### 9.3 差异小结

| 项目 | OpenWork | AIGO |
|------|----------|------|
| 配置键 | `sidecars/opencode` | `binaries/opencode` |
| 构建前脚本 | `prepare:sidecar`（还准备 openwork-server、opencode-router 等） | `download-opencode.mjs`（仅 OpenCode） |
| 版本来源 | opencodeVersion + 可选 GitHub latest | opencodeVersion / OPENCODE_VERSION / 默认 + 可选 latest |
| 运行时顺序 | sidecar → PATH | sidecar → PATH（一致） |

**结论**：AIGO 的内置 OpenCode 机制与 OpenWork 已对齐：均从 GitHub Releases 按 target 下载、打包为 Tauri sidecar、运行时优先 sidecar 再回退 PATH；差异仅在目录名与脚本职责范围。

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
   - 在 **设置** 中勾选「开启消息调试」，或在地址栏加 `?debug=1`（如 `http://localhost:1420/session/xxx?debug=1`）后，Console 会看到：
     - `[aigo:messages]`：拉取消息列表 API 的原始响应、normalize 后的条数、解析后的消息角色列表（user/assistant）。若这里只有 user 没有 assistant，说明服务端 GET message 未返回回复。
     - `[aigo:sse]`：SSE 事件类型与 properties。若发送后没有任何 `message.part.updated`，说明事件流未推送或未订阅到；若有事件但 sessionID 与当前会话不一致，可能是过滤逻辑问题（已做修复：无 sessionID 时按当前会话处理）。
   - 可根据上述日志判断问题在「接口未返回 assistant」还是「SSE 未触发/被过滤」。

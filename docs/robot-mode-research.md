# 机器人模式（类 OpenClaw）调研报告

本文档对应 PLAN 阶段 9：**远程用户通过 IM 与本地 AI 协作**。报告分三部分：① OpenClaw 侧机制；② 结合 OpenCode 的可塑性、扩展性与特性；③ 落地技术方案与实施计划。结论将用于后续在 PLAN 中拆解具体实现任务与自测项。

**参考来源**：OpenClaw 官方文档（[docs.openclaw.ai](https://docs.openclaw.ai)、[docs.clawd.bot](https://docs.clawd.bot)）、OpenCode 文档（[opencode.ai/docs](https://opencode.ai/docs/)）、项目内 [openwork-reference.md](openwork-reference.md)。

---

## 一、调研一：OpenClaw 侧机制

### 1.1 Bot 与 Gateway 架构

- **定位**：OpenClaw Gateway 是一个**常驻 Node.js 进程**，默认绑定 `127.0.0.1:18789`，作为多平台消息的中央枢纽。
- **连接方式**：与 Telegram、WhatsApp、Slack、Discord、Signal、iMessage 等通过 **WebSocket** 保持长连接，实现低延迟、双向通信，支持 7×24 主动式 agent 行为。
- **消息流（高层）**：
  ```
  入站消息 → 路由/绑定 → session key → 队列（若 main 正忙）→ agent 运行（流式 + 工具）→ 出站回复
  ```
- **会话归属**：会话由 **Gateway 持有**，而非各 IM 客户端持有。
  - 单聊默认收敛到 `main` 会话；
  - 群组/频道各自拥有 session key；
  - 会话存储与 transcript 在 Gateway 主机上；
  - 可用 `dmScope` 按 channel + sender 隔离 DM 上下文，便于多用户安全。
- **协议**：JSON 格式的 WebSocket 文本帧，含事件（`type:"event"`）与请求/响应（`type:"req"`/`type:"res"`）；带副作用的操作需 idempotency key 以安全重试。

**与 OpenCode 的对应**：OpenCode 使用 `session` + `message` + 工具调用；若 AIGO 做「IM 网管」，需定义「一个 IM 会话（或 per-user 会话）对应一个或多个 OpenCode session」的映射策略（一对一、或 IM 专用 session 等）。

### 1.2 消息处理（入站去重、合并、Body 区分）

- **入站去重**：基于 channel/account/peer/session/message id 的短时缓存，避免重连或重复投递触发多次 agent run。
- **入站防抖**：同一发送者在短时间内的多条消息可合并为一次 agent 轮次，按渠道可配（如 WhatsApp 5000ms、Slack 1500ms、Telegram 默认 2000ms）。
- **Body 区分**：
  - **CommandBody / RawBody**：用户原始输入，用于指令解析；
  - **Body**：发给 agent 的完整 prompt，可含 channel 信封与历史包装。
- **群聊**：可配置 `messages.groupChat.historyLimit`，历史缓冲区带发送者标签，保持与队列消息一致。

对 AIGO 的启示：网管层需要「去重 + 防抖 + 构造发给 OpenCode 的 prompt」的清晰流水线，并考虑群聊 @mention 与历史上下文策略。

### 1.3 安全机制

- **绑定与认证**：
  - 默认仅 **loopback**（`127.0.0.1:18789`），避免直接暴露公网；
  - 远程访问推荐 **Tailscale** 或 **SSH 隧道**，不推荐将端口直接暴露到 `0.0.0.0`；
  - 认证方式：**Token** 或 **密码**；Canvas UI 与 A2UI 等端点自 v2026.2.6 起需认证。
- **信任模型**：**个人助理**模型，假定每个 Gateway 实例对应一个可信操作者边界；**非多租户**，若多用户不可信，应使用独立 Gateway + 独立凭证与 OS 用户/主机。
- **加固与审计**：`openclaw security audit` 可检查常见误配置（网管认证暴露、过于宽松的 allowlist、文件系统权限）；`--fix` 可自动收紧策略（如将 `groupPolicy="open"` 改为 `allowlist`，将 `~/.openclaw` 权限设为 `700`）。

AIGO 若做「机器人模式」：默认也应仅本机可连、提供认证，并考虑提供类似的「安全审计」入口（至少文档化推荐配置）。

### 1.4 IM 工具网管机制（渠道适配、策略）

- **Telegram 示例**：
  - 支持 Markdown / HTML 等 parse mode；
  - 群聊默认需 **@bot 提及** 才触发；可通过 `mentionPatterns` 自定义；
  - 可配置 `inlineButtons`、`--thread-id`（论坛话题）等。
- **通用**：
  - 入站/出站走统一路由与绑定，多 channel 时由配置与 session 策略决定路由；
  - 速率限制、重试、离线队列依各平台 SDK 与 Gateway 实现而定。

落地时需按「首选渠道」（如 Telegram）先做单渠道最小闭环，再抽象出「渠道适配器」接口便于扩展。

### 1.5 本地文件与命令安全：Exec Approvals

OpenClaw 在**执行主机**上通过 **Exec Approvals** 做「安全联锁」：只有策略 + allowlist +（可选）用户批准都通过时，才允许在真实主机上执行命令。

- **存储**：`~/.openclaw/exec-approvals.json`（执行主机本地）。
- **策略维度**：
  - **security**：`deny`（全部拒绝）/ `allowlist`（仅白名单）/ `full`（全部允许）；
  - **ask**：`always`（每次都弹批）/ `on-miss`（仅未命中 allowlist 时弹批）/ `off`（不弹批）；
  - **askFallback**：当需要弹批但 UI 不可达时的行为（`deny` / `allowlist` / `full`）。
- **per-agent allowlist**：每个 agent（如 `main`）独立白名单，glob 匹配**可执行文件路径**（非仅 basename）；可记录 lastUsedPath、lastUsedCommand、lastUsedAt 等便于审计。
- **Safe bins**：如 `jq`、`cut`、`uniq`、`head`、`tail`、`tr`、`wc` 等「仅 stdin」的可执行文件，在 allowlist 模式下可不写显式条目即可运行，但会拒绝**位置参数中的文件路径**，避免通过 allow/deny 差异做 file-existence oracle；且从可信目录解析、禁止 shell 链式与重定向等。
- **审批流**：需要弹批时，Gateway 广播 `exec.approval.requested`；Control UI 或 macOS App 通过 `exec.approval.resolve` 回复；支持「Deny / Allow once / Always allow（并加入 allowlist）」；可将审批请求转发到聊天渠道，用 `/approve <id> allow-once|allow-always|deny` 回复。

与 OpenCode 的对比：OpenCode 的 `permission`（edit/write/bash 等）是「工具级」的 allow/ask/deny，且 `ask` 时通过 SSE `permission.asked` + API 回复。Exec Approvals 是「主机命令级」、带 per-agent 白名单与 safe bins。两者可并存：OpenCode 负责工具层，网管/桌面负责「在主机上执行」的二次审批与白名单（若采用类似 OpenClaw 的 exec 模型）。

### 1.6 授权与访问控制：Pairing 与 DM/群组策略

- **Pairing（DM）**：
  - 当 DM 策略为 `pairing`（默认）时，未知发送者会收到**短配对码**，消息在批准前不会被处理；
  - 配对码：8 位、大写、排除易混淆字符（0OI1）；1 小时过期；每渠道默认最多 3 个待处理请求；
  - 批准：`openclaw pairing approve <CHANNEL> <CODE>`；批准后写入 allowFrom。
- **凭证存储**：`~/.openclaw/credentials/` 下：
  - `-allowFrom.json`：已批准发送者；
  - `-pairing.json`：待处理配对请求；
  - 视为敏感数据，需限制权限。
- **DM 策略**：`pairing` | `allowlist` | `open`（需 `allowFrom: ["*"]`）| `disabled`。
- **群组策略**：默认 `allowlist`，需显式批准发送者；可配置 `requireMention: true`；群组可单独配置 allowlist 或回退到全局 allowFrom。

AIGO 若支持「远程 IM 用户」：需要类似的「首次接触 → 配对码 → 批准 → allowFrom」流程，以及群组的 mention 与 allowlist 策略，避免未授权用户驱动本地 AI。

### 1.7 本地 Cron 机制

- **持久化**：`~/.openclaw/cron/jobs.json`，由 Gateway 加载并写回；手动编辑仅建议在 Gateway 停止时进行。
- **执行模式**：
  - **isolated**：在 `cron:` 上下文中跑**独立 agent 轮次**，与 main 会话隔离，适合定时报告、后台任务；
  - **main**：将系统事件入队，在下次 heartbeat 时在主会话执行。
- **payload**：isolated 使用 `kind: "agentTurn"`，带 `message`（及可选 `deliver`）；CLI 用 `--session isolated` + `--message "..."`。
- **行为**：一次性任务（`--at`）默认成功后自删；周期性任务失败时指数退避重试。
- **与 Exec 的关系**：Cron 触发的 agent 若执行主机命令，同样走 Exec Approvals（在 gateway host 或 node host）。

对 AIGO：若要做「定时触发 AI 任务/提醒」，可参考「isolated vs main」的划分，以及任务持久化格式与重试策略；若复用 OpenCode，可考虑「Cron 触发 → 网管创建/复用 OpenCode session → prompt」的链路。

---

## 二、调研二：结合 OpenCode 的可塑性、扩展性与特性

### 2.1 OpenCode 可塑性/扩展性概览

- **插件（Plugins）**：
  - 从**本地目录**加载：`~/.config/opencode/plugins/`（全局）、`.opencode/plugins/`（项目级）；
  - 从 **npm** 加载：在 config 中 `"plugin": ["opencode-helicone-session", ...]`；
  - 插件可挂载多种**事件钩子**（如 `session.idle`、`message.part.updated`、`tool.execute.before`/`after`、`permission.asked` 等），并可注册**自定义工具**；
  - 加载顺序：项目插件目录 → 全局插件目录 → 项目 config → 全局 config。
- **MCP（Model Context Protocol）**：
  - 用于扩展工具与上下文，支持大量社区/官方 MCP 服务（文件、Git、数据库、浏览器等）；
  - 可在 `opencode.json` 中配置本地命令或远程 HTTP；Skills 可内嵌 MCP（如 lazy-loader 按需加载）。
- **Skills**：
  - 声明式能力，多路径检索 `SKILL.md`（项目 `.opencode/skills/`、全局 `~/.config/opencode/skills/` 等）；
  - 可描述对本地工具/MCP 的依赖，AIGO 已规划「当前 skills 列表、zip 安装、builtin 一键安装」。

**与机器人模式的结合点**：
- **方案 A**：由**网管服务**直接调用 OpenCode HTTP API（创建 session、发 prompt、订阅 SSE），不强制通过插件；插件可用于「把 IM 事件转成 OpenCode 侧事件」或「在 OpenCode 内注册 IM 相关工具」。
- **方案 B**：通过 **OpenCode 插件**在 OpenCode 进程内对接「网管收发包」的 MCP 或自定义工具，由 agent 主动拉/推消息；适合「agent 作为 IM 客户端」的形态，实现复杂度较高。
- **建议**：先采用方案 A（网管作为独立层，通过现有 OpenCode API 驱动 session），复用现有会话/消息/权限模型；若后续需要更紧耦合，再考虑插件/MCP 增强。

### 2.2 OpenCode 权限与工具执行

- **opencode.json 的 permission**：每类操作（如 `edit`、`write`、`bash`、`websearch` 等）可设为 `allow` / `ask` / `deny`；支持通配与模式。
- **ask 流程**：服务端发出 SSE `permission.asked`，payload 含 `id`、`sessionID`、`permission`、`patterns` 等；客户端需调用 `POST /session/:id/permissions/:permissionID`（或 SDK 等价）回复 `once` / `always` / `reject`。
- **AIGO 现状**：当前未监听 `permission.asked`，也未实现权限弹窗；计划在阶段 4 后续实现「在 AIGO 内实现权限弹窗」。
- **远程 IM 场景**：若用户通过 IM 远程操作，权限批复有两种思路：
  - **在桌面端**：仅当 AIGO 桌面打开时，由桌面 UI 弹窗批复；否则依赖 askFallback（如 deny 或配置的默认行为）；
  - **转发到 IM**：网管收到 `permission.asked`（需网管订阅 OpenCode SSE 或由 OpenCode 回调网管），在 IM 中发「待批准」消息，用户用命令或按钮回复 once/always/reject，网管再调 OpenCode 权限 API。后者与 OpenClaw 的「把 exec 审批转发到聊天渠道」类似。

建议：技术方案中明确「权限批复」是仅桌面、仅 IM、还是双端可选，以及未批复时的 fallback。

### 2.3 会话与多端一致性

- OpenCode 的 **session** 与 **message** 模型是通用的，不区分「桌面发起」还是「网管发起」；只要共用同一 `opencode serve` 与同一 DB，桌面 UI 与网管看到的会话列表与消息一致。
- **SSE**：`client.event.subscribe()` 是全局流；网管若以同一 client（或同一服务）连接，可收到同一批事件，需按 sessionID 过滤出「网管负责的会话」并转发到 IM。
- **会话标题**：服务端可自动更新 title；在 `session.idle` 时拉取 session 详情或列表即可拿到最新 title，网管可将 title 用于 IM 侧展示或通知。
- **多端**：若希望「同一会话在桌面与 IM 双端可见」，无需额外协议，只需网管与桌面共用 OpenCode 实例并约定「某 session 由 IM 创建或绑定」；若希望「IM 专用会话」与「桌面专用会话」隔离，可通过 session 元数据或命名约定区分。

### 2.4 与 AIGO 桌面端的关系

- **共用 OpenCode 实例**：网管与 AIGO 桌面连接同一 `opencode serve`（同端口、同 DB），实现简单、会话统一；需考虑并发（同一 session 同时被桌面与 IM 发消息时的策略）与「谁创建 session」的规则。
- **独立 Gateway 进程**：若网管与 OpenCode 分离部署（如网管在另一台机器通过 Tailscale 连 OpenCode），则网管仅作为「另一客户端」，逻辑不变，但需配置 OpenCode 的认证与网络可达性。
- **进程形态**：网管可以是「独立 Node/Rust 进程」「Tauri 侧边/后台服务」或「与 opencode serve 同进程（需改 OpenCode）」。建议先采用**独立进程**，与 AIGO 桌面并列，通过配置文件或桌面「启用机器人模式」开关启动/停止网管，便于迭代与安全边界清晰。

---

## 三、调研三：落地技术方案与实施计划

### 3.1 技术方案摘要

- **架构选型**
  - **网管形态**：建议**独立进程**（如 Node 或 Rust），与 AIGO 桌面并列；默认仅绑定 `127.0.0.1`，端口可配置（如 18789 或与 OpenClaw 错开）。
  - **与 OpenCode**：网管作为 **OpenCode 的 HTTP 客户端**，连接现有 `opencode serve`（与 AIGO 共用同一实例）；会话、消息、权限、SSE 均通过现有 API 完成。
  - **是否复用 OpenClaw**：OpenClaw 为完整产品，与 OpenCode 无直接集成；AIGO 可参考其协议与配置，做**轻量自研网管**，只实现「单渠道（如 Telegram）+ 最小会话与安全」闭环，减少对 OpenClaw 代码依赖与协议绑定。

- **组件划分**
  - **IM 适配层**：按渠道拆模块（如 `telegram`、后续 `slack`）；负责收消息、去重、防抖、构造 Body、发回复；输出「标准化入站事件」与「出站发送接口」。
  - **会话路由与映射**：维护「IM channel/chat/sender → OpenCode sessionID」映射；策略可为「每 (channel, user) 一个 session」或「单 main session」；持久化到本地 JSON 或 SQLite。
  - **安全与授权**：实现**配对**（生成 8 位码、过期、待处理上限）、**allowFrom** 存储（`-allowFrom.json` 风格）；DM/群组策略（pairing / allowlist / open / disabled）；群组可配置 requireMention。
  - **命令/文件安全**：第一版可与 OpenCode permission 对齐（仅依赖 opencode.json 的 allow/ask/deny）；若需「主机命令白名单」，再引入 **Exec Approvals 风格**的独立配置与 UI（或复用 OpenClaw 的 exec-approvals 逻辑做子模块）。
  - **Cron**：可选；若有需求，可单独 **Cron 调度器**（读取 `jobs.json` 类配置），在到点时向网管或 OpenCode 发起「创建/复用 session + prompt」请求；执行主机命令时仍走 OpenCode permission 或 Exec 策略。

- **技术栈与依赖**
  - **语言/运行时**：Node.js 或 Rust 二选一；Node 与 Telegram 等 SDK 生态好，Rust 与 Tauri 同栈、可打包为单一二进制。
  - **IM**：首选 **Telegram Bot API**（或 Telegraf 等），文档与生态成熟；配置 Bot Token 与 Webhook/Polling。
  - **配置与持久化**：建议目录 `~/.aigo/robot/` 或 `app_data_dir/robot/`（与 AIGO 一致）；内存 `config.json`、`credentials/-allowFrom.json`、`credentials/-pairing.json`、`cron/jobs.json`（若做 Cron）、会话映射存储。

- **安全与部署**
  - 默认 **仅 loopback**；远程访问文档化「SSH 隧道 / Tailscale」。
  - 认证：网管自身可设 **token 或密码**，供 AIGO 桌面或 Control UI 连接时使用。
  - 桌面端：设置项「启用机器人模式」开关，控制是否启动网管进程；首次启用时引导「配对码 + 安全说明」；可选提供「安全审计」检查项（端口暴露、allowFrom 权限等）。

### 3.2 实施计划（阶段划分）

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| **① 网管骨架 + 单渠道最小闭环** | 独立网管进程；仅 Telegram；连接本机 OpenCode；入站消息 → 去重/防抖 → 创建或复用 session → prompt → 回复到 Telegram | 从 Telegram 发一条消息，能在 OpenCode 中产生会话并收到 AI 回复且回显到 Telegram |
| **② 授权与 Pairing** | 实现 DM 策略（pairing/allowlist/open/disabled）、配对码生成与批准、allowFrom 与 pairing 存储；群组策略与 requireMention（可选） | 未知用户需配对码批准后才能对话；已批准用户可正常对话 |
| **③ 命令/文件安全与权限** | 桌面端权限弹窗（阶段 4 已有规划）与网管侧「权限转发到 IM」可选；若做 Exec 层，则实现 allowlist + ask 策略与存储 | 配置 ask 时，桌面或 IM 能批复；拒绝时工具不执行 |
| **④ Cron（可选）** | 持久化 cron 配置；调度器在到点触发「isolated 或 main」风格的 agent 轮次；与 OpenCode session 打通 | 定时任务到点执行并在预期会话中可见结果 |
| **⑤ 多渠道与策略扩展** | 抽象渠道接口；增加第二渠道（如 Slack）；统一配置与审计 | 多 channel 可配置、路由正确、安全策略一致 |

### 3.3 优先级与依赖

- **① 依赖**：OpenCode 已可 `opencode serve` 且 AIGO 能连接（阶段 2）；无需等待阶段 4 权限弹窗。
- **② 依赖**：① 完成；无其他强依赖。
- **③ 依赖**：与阶段 4「权限弹窗」并行或在其后；若先做「仅桌面批复」，网管可暂不处理 `permission.asked`。
- **④ 依赖**：① 或 ② 完成即可设计；与 ③ 无强依赖。
- **⑤ 依赖**：① ② 完成后再做，避免首版复杂度过高。

与 PLAN 其他阶段：**阶段 4**（权限）与 ③ 衔接；**阶段 7**（本地能力/SKILL）与「Exec 白名单」可共用「安全调用本地可执行」的抽象，具体在实现时再对齐。

### 3.4 排期与输出

- **排期**：建议在 PLAN 中把「阶段 9 实现」放在阶段 4（消息/权限）基本完成后、阶段 7/8 可并行；① ② 可在一个迭代内完成，③ ④ ⑤ 按需排期。
- **输出**：本调研报告作为 **设计文档** 的一部分；评审通过后，在 **PLAN.md 第 9 节 9.4** 下拆出具体实现任务（如「实现网管进程入口」「实现 Telegram 适配器」「实现 pairing 存储与 CLI/UI」等）及每项自测标准。

---

## 四、小结与风险

- **OpenClaw**：提供了成熟的 Gateway 架构、消息流、Exec Approvals、Pairing、Cron 与安全实践，可直接借鉴协议与配置形态；AIGO 采用「轻量自研网管 + 连接现有 OpenCode」可降低耦合与维护成本。
- **OpenCode**：会话/消息/权限/SSE 已足够支撑「网管驱动会话」；插件/MCP/Skills 可在后续用于增强（如 IM 专用工具或通知）。
- **风险**：① 多端同时操作同一 session 的并发与一致性需约定；② 权限「转发到 IM」需考虑延迟与撤销；③ Exec 层若自研，需严格限制路径与 safe bins，避免 file-existence 与命令注入。

---

**文档状态**：初稿，供阶段 9 调研与方案评审使用。后续实现任务以 PLAN 更新为准。

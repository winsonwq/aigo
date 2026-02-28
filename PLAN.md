# 项目规划

## 目标

- 做一个基于 OpenCode 的类 OpenWork 桌面应用（AIGO）：Tauri 2.0 + React 前端，内置 OpenCode 的下载与自启动连接，完整会话/消息/工具调用展示、Skills 管理，并预留与 Vercel AI SDK 集成的评估空间。

---

## 阶段 / 里程碑

| 阶段 | 目标                                                              | 状态     |
| ---- | ----------------------------------------------------------------- | -------- |
| 1    | Tauri 2.0 + React 客户端骨架                                      | 完成     |
| 2    | OpenCode 下载与 builtin 启动、自动连接                            | 进行中   |
| 3    | UI 体系：Shadcn/ui、Layout、Sidebar、Menu、Router、Icons          | 完成     |
| 4    | OpenCode Client SDK 集成：事件监听、消息/工具展示、react-markdown | 进行中   |
| 5    | Skills 管理：已安装列表、zip 安装、skills.sh 搜索/安装/卸载、进度与输出、打开/定位文件夹 | 完成     |
| 6    | （可选）Vercel AI SDK 集成评估与落地                              | 待开始   |
| 7    | 本地能力扩展：以 SKILL 方式扩展（ffmpeg、whisper、Python/Node、agent browser 等） | 调研中   |
| 8    | Subagent 输出增强：会话内可见子任务/子 agent 输出                 | 待开始   |
| 9    | 机器人模式（类 OpenClaw）：远程用户通过 IM 与本地 AI 协作、安全与网管机制 | 调研中   |

---

## 功能实施计划

### 1. Tauri 2.0 + React 客户端应用

参考：`create-tauri-app` 选 React + Vite + TypeScript；或社区模板 `create-tauri-react`（含 Tailwind）。

- [x] 使用 `pnpm create tauri-app@latest`（或 `npm create tauri-app@latest`）创建项目，包名/identifier 按 AIGO 填写。（已创建于项目根目录，identifier 已改为 `com.aigo.app`）
- [x] 前端模板选择 **React**，语言选 **TypeScript**，包管理选 **pnpm**。
- [x] 确认生成结构：`src-tauri/`（Rust）、前端根目录（如 `src/`）、`vite.config.ts`、`tauri.conf.json`。
- [x] 配置 **ESLint** 与 **Prettier**，规则与后续 Tailwind/Shadcn 不冲突。（已加 `eslint.config.js`、`.prettierrc`，`pnpm lint` / `pnpm format` 可用）
- [x] 确认 `pnpm dev` 启动 Tauri 窗口并加载 Vite 开发服；`pnpm tauri build`（或等价）产出安装包。（前端 `pnpm run build` 已通过；完整 `pnpm tauri build` 需本机可访问 crates.io）
- [x] 预留后续 **sidecar**：确认 `tauri.conf.json` 中 resources/sidecar 配置方式，便于后续挂载 OpenCode 二进制。（见 [Tauri sidecar](https://v2.tauri.app/develop/calling-rust/sidecar/)，根目录 README 已注明）
- [x] **自测**：能成功 `pnpm dev` / `pnpm tauri build` 并启动空白窗口，无报错。（lint + 前端 build 已通过；本机执行 `pnpm tauri dev` 可验证窗口）

---

### 2. 基于 OpenCode 的类 OpenWork 能力：下载与 builtin 启动、自动连接

**当前优先**：应用**内置维护一个 OpenCode 实例**（下载/侧载 + 自启动），并**自运行、自动连接**；不依赖用户本机已安装的 opencode。  
**后续扩展**：支持「连接别的 opencode 服务」（远程/他机）时，再一并做认证（如 `OPENCODE_SERVER_PASSWORD`、HTTP Basic Auth 等），不在当前内置实例流程里处理。

参考：OpenWork 执行 `opencode serve --hostname 127.0.0.1 --port <port>`；二进制可放 Tauri sidecar 或应用数据目录。[different-ai/openwork](https://github.com/different-ai/openwork) 的 sidecar/安装见 [Issue #121](https://github.com/different-ai/openwork/issues/121)。

- [ ] **调研**：看 OpenWork 仓库中 `packages/desktop/src-tauri/sidecars`、releases 里是否带 OpenCode 二进制；记录各平台（macOS arm/x64、Windows、Linux）的下载 URL 或打包方式。
- [ ] **版本与平台**：定义「当前支持的 OpenCode 版本」（如 latest 或固定版本）；实现运行时检测 OS/arch（Tauri 或 JS 侧），决定下载哪一档二进制。
- [ ] **下载流程**：实现下载可执行文件到应用目录（如 Tauri `app_data_dir` 或 sidecar 目标路径）；带进度与失败重试；可选校验（checksum/签名）。
- [x] **Sidecar/Command**：在 Tauri 中配置 OpenCode 为 sidecar，或从应用目录 spawn 子进程；启动命令固定为 `opencode serve --hostname 127.0.0.1 --port <port>`，端口可配置（如 4096），避免与已有进程冲突。（已实现 Tauri 命令 `start_opencode_serve(port)`，依赖本机 PATH 上的 opencode）
- [x] **连接**：前端或 Tauri 层在「应用启动」或「连接」时，用 `@opencode-ai/sdk` 的 `createOpencodeClient({ baseUrl: "http://127.0.0.1:<port>" })` 连接；实现 **health 轮询** 与 **断线重连**（退避策略）。（已实现：侧栏「连接」触发 Tauri 启动 serve → 前端用 `@opencode-ai/sdk/v2/client` 创建客户端并 health 检查；连接后每 10s 轮询 health，失败则置为断线并允许重连）
- [ ] **自测**：从「本机无 OpenCode」到「下载 → 启动 serve → 客户端连接」全流程可重复；重启应用后能自动启动进程并连接成功。（当前已支持本机 PATH 上的 opencode 启动与连接）
- [ ] **（后续）连接其他 OpenCode 服务与认证**：若支持「连接别的 opencode 服务」（远程 URL 或他机），在该能力中一并实现认证（密码/HTTP Basic、如 `OPENCODE_SERVER_PASSWORD`）；当前仅面向本机内置实例，不做认证。

---

### 3. UI：Tailwind 兼容组件库、Layout、Sidebar、Menu、Router、Icons

- [x] 在现有 Vite+React 项目中安装 **Tailwind CSS**（`tailwindcss` + `@tailwindcss/vite`），按 v4 配置；`App.css` 已加 `@import "tailwindcss"`。
- [ ] 集成 **Shadcn/ui**：可后续运行 `npx shadcn@latest init` 按需添加组件；当前使用 **Tailwind 自搭** Layout/Sidebar，风格与 Shadcn 兼容。
- [x] **根 Layout**：已实现根布局（主内容区 + 左侧固定 Sidebar）；`src/components/Layout.tsx` + `Sidebar.tsx`。
- [x] **Sidebar 内容**：顶部标题「AIGO」；导航含 **会话**（/）、**Skills**（/skills）、**设置**（/settings）；Sessions 列表为占位，后续接 SDK。
- [x] **路由**：已安装 **react-router-dom**，使用 **BrowserRouter**（History API，无 `#`）；路由：`/`（Home）、`/session/:id`（Session）、`/settings`、`/skills`。
- [x] **Menu 与高亮**：Sidebar 使用 `NavLink`，当前路由高亮；点击跳转正常。
- [x] **Icons**：已集成 **lucide-react**（MessageSquare、Sparkles、Settings），在 Sidebar 统一使用。
- [x] **自测**：`pnpm lint`、`pnpm run build` 通过；Layout/Sidebar/路由在打包后正常，可本地 `pnpm tauri dev` 验证窗口与跳转。

---

### 4. OpenCode 事件与消息展示：Client SDK、react-markdown

OpenCode 事件参考：[插件 (Plugins)](https://www.opencodecn.com/docs/plugins)（如 `session.*`、`message.updated`、`tool.execute.before`/`after`、`server.connected`）。

- [x] 在连接成功后，使用 **@opencode-ai/sdk** 的 client 订阅/轮询 **会话列表**（若 SDK 或后端提供 list sessions API）；与 Sidebar 的 Sessions 列表状态同步（新建、切换、删除）。（已实现：`useSessions` 拉取 `session.list`、每 15s 刷新；Sidebar 与 Home 展示列表；新建会话 `session.create` 并跳转 `/session/:id`；删除待阶段 4 后续做）
- [x] **会话详情**：进入 `/session/:id` 时加载该会话的消息列表；区分 **用户消息** 与 **AI 消息**；若 SDK 支持流式，则对接流式更新并实时追加到 UI。（已实现：`useSessionMessages` 拉取消息、Session 页展示用户/AI 气泡；发送 prompt 后 refetch；SSE 流式见下）
- [x] **Markdown 渲染**：安装 **react-markdown**；对 AI 消息内容用 react-markdown 渲染；配置 `remark-gfm`（表格、脚注等）、代码块高亮（如 `rehype-highlight` 或 `react-syntax-highlighter`）；防止 XSS（使用默认安全行为或 sanitize）。（已实现：react-markdown + remark-gfm，代码块高亮可后续加 rehype-highlight）
- [x] **工具调用展示**：订阅或从消息上下文中拿到 `tool.execute.before`/`after` 等；在消息下方或右侧面板以列表/时间线形式展示「工具名、参数、结果/状态」。（已实现：从消息 parts 中 type===tool 的 part 展示工具名、状态、input/output/error）
- [x] **流式订阅**：使用 `client.event.subscribe()` 订阅 SSE；先订阅再 `client.session.prompt()`，在回调中处理 `message.part.updated` 等事件并按 sessionID 更新当前会话 UI（参考 [docs/openwork-reference.md](docs/openwork-reference.md)）。（已实现：`useSessionMessages` 内订阅 event.stream，对 message.part.updated 按 sessionID 合并 part/delta 到本地 messages 状态）
- [ ] **Session Artifacts（产出/修改文件列表）**：在会话内展示本 session 涉及的 **artifacts**——即本轮对话中**被创建或修改的文件**。数据来源：从工具调用中汇总（如 `edit`、`write`、`patch` 等工具的参数中的文件路径），或从事件流中的 `file.edited`、`file.watcher.updated` 等（若 SDK/服务端暴露）按 session 聚合。在会话页用**列表/面板**展示：文件路径、操作类型（新建/修改）、可选时间或顺序；支持点击在编辑器中打开或定位（若后续集成）。详见 [docs/openwork-reference.md](docs/openwork-reference.md) 中「文件与 Artifacts」。
- [ ] **自测**：创建会话、发消息、触发工具调用后，会话列表、消息内容（含 Markdown）、工具调用展示正确；流式无错乱；**产出的文件在 Artifacts 列表中正确列出**（新建/修改可区分）。（当前消息/工具/流式已可验证）

---

### 5. Skills 管理：全面兼容 skills.sh（搜索、安装、进度条、卸载）

OpenCode 会在多路径下检索 `SKILL.md`：[Agent Skills](https://opencode.ai/docs/skills/)

- 项目：`.opencode/skills/<name>/SKILL.md`、`.claude/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md`
- 全局：`~/.config/opencode/skills/<name>/SKILL.md`、`~/.claude/skills/`、`~/.agents/skills/`  
  每个 skill 为目录，内含 `SKILL.md`，且需 YAML frontmatter：`name`（必填）、`description`（必填）。与 [skills.sh](https://skills.sh/) 兼容：通过 **skills.sh API** 搜索、**npx skills add** 安装、**npx skills remove** 卸载；安装过程支持阶段式进度；若 skill 声明 `resources`（大文件如 Whisper 模型），可做 HTTP 流式下载与精确进度条（后续扩展）。

- [x] **Skills 页面**：在路由中增加 **Skills 管理** 页（如 `/skills`），Sidebar 增加入口（图标 + 「Skills」）。（已实现）
- [x] **「已安装 skills」列表**：已安装列表数据来自 Tauri `list_installed_skills`（磁盘扫描各 skills 目录，与 OpenCode 检索路径一致）；`useSkills` + Skills 页「已安装」Tab 展示；安装/卸载后 refetch 刷新。（已实现）
- [x] **列表 UI**：卡片展示 skill 的 name、description、路径/来源；支持按名称/描述/路径搜索筛选；每项支持**打开/定位所在文件夹**（`revealItemInDir`）、**卸载**（确认后调用 `uninstall_skill`）。（已实现）
- [x] **通过 zip 安装**：提供「从 zip 安装」入口（按钮 + 文件选择）。选择 zip 后由 Tauri 命令 `install_skill_from_zip` 解压到目标目录（全局或项目目录）；解压后校验 SKILL.md 与 frontmatter，失败则清理并提示。（已实现）
- [x] **zip 格式约定**：UI 文案说明 zip 内需包含 SKILL.md 且含 name、description 的 YAML frontmatter；支持 zip 根目录即 SKILL.md 或单层子目录内含 SKILL.md。（已实现）
- [x] **全面兼容 skills.sh：搜索**：Tauri 命令 `search_skills_via_api` 请求 skills.sh 搜索 API（避免 CORS），前端展示结果列表、分页与「加载更多」；每项「安装」按钮；支持「在 skills.sh / GitHub 中打开」链接。（已实现）
- [x] **全面兼容 skills.sh：安装**：Tauri 命令 `install_skill_from_source` 调用 `npx skills add ... -g -a opencode -y`（及可选 `--skill`）；「其他」Tab 支持粘贴 owner/repo 或 URL 安装；已安装项根据 `list_installed_skills` 判断，同名安装前可确认覆盖。（已实现）
- [x] **安装流程与进度展示**：CLI 安装用阶段式进度（`install_skill_progress` 事件：准备 → 克隆/安装中 → 校验）；安装 run 通过 `RunOutputContext` 展示，可点击终端图标查看输出；成功/失败 toast 提示。（已实现阶段式进度与输出查看；大文件/resources 精确进度条为后续可扩展）
- [x] **卸载**：Tauri 命令 `uninstall_skill`（内部 `npx skills remove`）；已安装列表中每项提供卸载按钮，确认后执行并刷新列表；支持按 skill 名称与路径指定卸载目标。（已实现）
- [ ] **自测**：搜索（含默认热门）→ 结果列表带安装按钮与加载更多；从粘贴 source 或搜索结果安装 → 阶段进度/输出查看 → 成功并出现在已安装列表；卸载后列表更新；未装 Node 时安装失败有错误提示。带 resources 的 skill 下载阶段精确进度条待后续扩展后补充自测。

---

### 6. （可选）Vercel AI SDK 集成评估

- [ ] **调研**：阅读 [Vercel AI Gateway - OpenCode](https://vercel.com/docs/ai-gateway/opencode)、`ai-sdk-provider-opencode-sdk`（若有），确认与当前「@opencode-ai/sdk + 事件订阅」架构是否冲突（协议、流格式、工具调用格式）。
- [ ] **决策**：若兼容，则规划在哪些能力上引入 AI SDK（如统一 stream、useChat）；若冲突，则在文档中记录「暂不采用 AI SDK」及原因。
- [ ] **自测**：若集成，验证流式输出、工具调用在 AI SDK 与 OpenCode 并存时行为正确。

---

### 7. 本地能力扩展（以 SKILL 方式出现与扩展）

**宗旨**：在不增加默认安装包体积的前提下，让用户通过「可选 CLI/侧载」享受本地扩展能力。**为保证未来兼容性与统一扩展面，这些能力应以 SKILL 的形式出现和扩展**——即由 SKILL 描述对本地工具/MCP/侧载的依赖与调用方式，应用层提供「发现、配置、调用」的通用支撑，而非在应用内写死每一种工具。

**典型可被 SKILL 封装的本地能力**（需调研可行性及 SKILL 侧约定）：

- **ffmpeg**：体积可控可考虑内置或 sidecar；或 SKILL 声明依赖「本机 ffmpeg」，用于音视频转码/剪辑等。
- **本地 Whisper**：模型下载 + 本地 CLI（whisper.cpp、faster-whisper 等），由 SKILL 描述安装与调用方式，不把大模型打进默认包。
- **本地 Python / Node.js**：SKILL 声明需要本机 Python 或 Node 环境，描述如何执行脚本或 npx；应用或 OpenCode 侧提供统一的检测、沙箱与调用抽象。
- **Agent Browser**：浏览器自动化、页面快照、表单填写等，以 MCP 或本地 CLI 形式存在；通过 SKILL 声明依赖并暴露为工具，便于版本与能力独立演进。
- **其他本地 CLI/可执行**：ripgrep、fd、shell 脚本、平台 exe 等，统一抽象为「SKILL 可声明的本地扩展」——检测是否已安装、引导安装、在会话或工具中安全调用。

**实现与调研要点**：

- [ ] **SKILL 与本地能力的契约**：调研并约定 SKILL 如何声明「依赖的本地工具/MCP」（如 frontmatter 或 SKILL.md 内约定）；应用或 OpenCode 如何解析并校验环境、引导安装。
- [ ] **应用层通用能力**：桌面端提供发现本机已安装工具、配置路径/环境、安全调用（超时、沙箱）的通用机制，供任意符合契约的 SKILL 使用，而非为 ffmpeg/whisper 等单独写死逻辑。
- [ ] **示例 SKILL**：为上述典型能力（含 agent browser）各维护或引用一个示例 SKILL，验证「以 SKILL 方式出现和扩展」的闭环；文档说明如何编写依赖本地工具的 SKILL。
- [ ] **自测**：安装某「本地能力型」SKILL 后，在未安装/已安装对应工具两种状态下行为符合预期；不增加默认包体积；新增或升级本地能力时只需更新 SKILL，无需改应用本体。

---

### 8. Subagent 输出增强

当前会话内**子任务 / subagent 的进度与输出不可见**，用户无法感知多步或并行子 agent 的执行情况。

- [ ] **调研**：确认 OpenCode 事件/消息中是否已有 subagent、子任务或「步骤」相关事件（如 `task.step.*`、`agent.child.*`）；若没有，是否可通过工具调用、消息 part 或扩展协议间接推断。
- [ ] **UI 设计**：在会话消息或工具调用区域，以**折叠/时间线/树形**等方式展示 subagent 或子步骤：名称、状态（进行中/完成/失败）、输入摘要、输出摘要或全文；支持展开/收起。
- [ ] **实现**：对接上述数据源，在 Session 页渲染 subagent 块；流式场景下子步骤的增量更新与合并。
- [ ] **自测**：触发含 subagent 或多步工具调用的会话时，子任务在 UI 中可见、状态与输出正确更新。

---

### 9. 机器人模式（类 OpenClaw）：远程用户通过 IM 与本地 AI 协作

**目标**：实现与 OpenClaw 类似的「用户远程通过 IM（如 Telegram 等）与本地 AI 协作」能力，在保证安全与可控的前提下，让 AIGO/OpenCode 作为本地网关，对接 IM 渠道并驱动 OpenCode 会话与工具执行。本阶段以**详尽的调研与结合 OpenCode 特性的方案分析**为主，为后续实现打基础。

**参考**：OpenClaw 文档（[docs.openclaw.ai](https://docs.openclaw.ai)、[docs.clawd.bot](https://docs.clawd.bot)）、安全与网管（[Security](https://docs.clawd.bot/gateway/security)、[Exec Approvals](https://docs.openclaw.ai/tools/exec-approvals)、[Cron](https://docs.openclaw.ai/cli/cron)）；OpenCode 插件/权限/Skills 见 [docs/openwork-reference.md](docs/openwork-reference.md) 与 [opencode.ai/docs](https://opencode.ai/docs/)。**调研报告**：[docs/robot-mode-research.md](docs/robot-mode-research.md)（三部分：OpenClaw 机制、OpenCode 可塑性、落地技术方案与计划）。

#### 9.1 调研一：OpenClaw 侧机制（需详尽）

- [ ] **Bot 机制**：梳理 OpenClaw Gateway 的 bot 架构——如何接收 IM 消息、如何映射到「会话/会话内轮次」、多会话/多用户时的隔离与路由；与 OpenCode 的 session/message 模型如何对应（一对一、多会话 per-user 等）。
- [ ] **安全机制**：梳理 Gateway 绑定（如仅 loopback `127.0.0.1`）、认证方式（token、密码）、远程访问建议（Tailscale、SSH 隧道）；`openclaw security audit` 与加固项（如 `--fix` 收紧 groupPolicy、目录权限 700 等）；「个人助理」信任边界与多租户不适用性。
- [ ] **IM 工具网管机制**：各 IM 渠道（如 Telegram）的适配方式、消息入站/出站格式、网管与 Gateway 的职责划分；速率限制、重试、离线队列（若有）；多 channel 时的配置与路由策略。
- [ ] **本地文件与命令安全防护**：OpenClaw 的 **Exec Approvals**（`deny` / `allowlist` / `full`，以及 `ask`: `always` / `on-miss` / `off`）、审批存储（如 `~/.openclaw/exec-approvals.json`）、per-agent 白名单与 glob 限制；与「本地文件访问」相关的策略（读/写范围、沙箱或路径限制）；safe bins 与防 file-existence oracle 等设计。
- [ ] **授权与访问控制**：**Pairing** 机制（8 位配对码、过期与待处理数限制）、DM 策略（`pairing` / `open` / `allowlist` / `disabled`）、群组策略（allowlist、requireMention）；凭证与待处理请求的存储（`-allowFrom.json`、`-pairing.json`）；与 AIGO 现有「单机桌面用户」模型的差异及对「远程 IM 用户」的借鉴方式。
- [ ] **本地 Cron 机制**：Cron 调度在 Gateway 内的位置、持久化（如 `~/.openclaw/cron/jobs.json`）、任务定义（schedule、isolated agent turn vs main session、payload）；与系统命令执行的关系及是否走同一套 Exec Approvals；对「定时触发 AI 任务/提醒」在 AIGO 中的可复用性分析。

#### 9.2 调研二：结合 OpenCode 的可塑性、扩展性与特性

目标是在「不重复造轮子」的前提下，让机器人模式尽量复用 OpenCode 已有能力，并明确 AIGO 需补足的部分。

- [ ] **OpenCode 可塑性/扩展性**：梳理 OpenCode 的 **插件**（事件钩子、本地/项目插件目录、npm 插件）、**MCP**（工具扩展、权限与沙箱）、**Skills**（声明式能力、可含 MCP）；哪些适合作为「IM 触发的任务」的载体（如通过 MCP 暴露「网管收发」、通过插件做 IM 事件→session 的桥接）。
- [ ] **OpenCode 权限与工具执行**：对照现有 **opencode.json 的 permission**（`allow` / `ask` / `deny`）与 AIGO 已规划的「权限弹窗」；在「远程 IM 用户」场景下，是否需额外层（如 Exec Approvals 式的命令白名单、或与 OpenCode permission 的映射）；文件类工具（edit/write/patch）与本地命令执行在安全模型上的统一表述。
- [ ] **会话与多端一致性**：OpenCode 的 session/message 模型是否足以支撑「同一会话在桌面 UI 与 IM 双端可见」或「IM 专用会话」；事件流（SSE）、会话列表与标题自动更新在「网管驱动」下的行为；若需「IM 侧只读/限速」，在协议或网关层的切分点。
- [ ] **与 AIGO 桌面端的关系**：机器人模式作为「同一 OpenCode 实例的又一入口」还是「独立 Gateway 进程」；若共用实例，连接方式（同一 `opencode serve`、同一 DB）、并发与锁；若独立，配置与二进制（sidecar 或独立部署）的取舍。
- [x] **输出物与文档**：将上述调研结论整理成 **设计文档**（如 `docs/robot-mode-design.md` 或写入 openwork-reference），包含：OpenClaw 机制小结、OpenCode 可复用点、差距与风险、推荐架构（含网管、安全、cron 的职责划分）及分阶段实现建议。（已产出 [docs/robot-mode-research.md](docs/robot-mode-research.md)）

#### 9.3 调研三：落地技术方案与计划

在 9.1、9.2 结论基础上，明确**技术方案**与**实施计划**，写入设计文档并反哺 PLAN 的拆任务与排期。

- [ ] **技术方案**  
  - **架构选型**：网管服务形态（独立进程 / 内嵌 Tauri / 与 opencode serve 同进程）；与现有 `opencode serve` 的连接方式（本机 HTTP、同一 DB、或网管直调 OpenCode API）；是否复用 OpenClaw 开源实现或自研轻量网关。  
  - **组件划分**：IM 适配层（按渠道拆模块）、会话路由与映射、安全与授权模块（pairing、allowlist、Exec Approvals 或与 OpenCode permission 的桥接）、Cron 调度器（独立服务或挂到网管）；各组件与 AIGO 桌面端、OpenCode 的边界与接口。  
  - **技术栈与依赖**：网管/适配层语言与运行时（Node/Rust/其他）；IM 官方 SDK 或协议（如 Telegram Bot API）；配置与持久化（与 `~/.openclaw` 类似的目录约定、或沿用 AIGO 的 app_data_dir）。  
  - **安全与部署**：默认仅 loopback、认证方式、远程访问推荐（SSH 隧道/Tailscale）；桌面端「启用机器人模式」的开关、首次配对与审计（如 security audit 的落地形式）。

- [ ] **实施计划**  
  - **阶段划分**：按依赖关系拆成可交付阶段（例如：① 网管骨架 + 单 IM 渠道最小闭环；② 授权与 pairing；③ 命令/文件安全与 Exec 策略；④ Cron；⑤ 多渠道与策略扩展），并标出每阶段的验收标准。  
  - **优先级与依赖**：哪些依赖 9.1/9.2 的结论、哪些可并行；与 PLAN 其他阶段（如阶段 4 权限弹窗、阶段 7 本地能力）的衔接点。  
  - **排期或顺序**：在设计文档中给出推荐实施顺序与粗略工作量估计（或标注「待评审后排期」），便于在 PLAN 中插入具体 todo 与里程碑。

- [x] **输出**：将**技术方案**与**实施计划**纳入设计文档；评审通过后，在 PLAN 本节下拆出 9.4 的具体实现任务与自测项。（已纳入 [docs/robot-mode-research.md](docs/robot-mode-research.md) 第三部分）

#### 9.4 后续实现（待调研与方案结论后再拆子任务）

- [ ] 在 9.1～9.3 与设计文档完成后，在 PLAN 中拆出具体实现任务（网管服务、IM 适配、权限/Exec 策略、cron 集成、自测方案等）。
- [ ] **自测**：随实现阶段补充（如：仅本机可连网管、配对/allowlist 生效、命令执行经审批、cron 触发与 OpenCode 会话一致等）。

---

## 从 OpenWork 可参考的基础功能（OpenCode Client 使用等）

OpenWork 与 OpenCode 的通信方式、API 用法、可选方案已整理到 **[docs/openwork-reference.md](docs/openwork-reference.md)**，实现阶段可直接对照。此处仅列与「基础功能」相关的、可拆成任务或决策点的项。

- **HTTP API + SDK（必用）**
  - 使用 `createOpencodeClient({ baseUrl })` 连接；`client.session` 做会话 CRUD；`client.session.prompt()` 发消息（同步）。
  - 使用 **`client.event.subscribe()`** 订阅 SSE，处理 `message.part.updated` 等实现流式对话；健康检查用 `client.global.health()`，用于重连与状态展示。
- **流式对话**：先 `event.subscribe()` 再 `session.prompt()`，在回调里按 `sessionID` 过滤并更新 UI（与 OpenWork 一致）。
- **模型与 Provider 配置（free / OpenRouter 与界面配置）**
  - OpenCode 有部分 **free** 模型（如 OpenRouter 上的 `z-ai/glm-4.5-air:free`）可直接使用；**多数模型**（含 OpenRouter 上的 MiniMax、Kimi 等）需要**配置或授权**后才能使用。
  - **配置方式**：① **opencode.json**（全局 `~/.config/opencode/opencode.json` 或项目根）中的 `provider`、`model`；② **环境变量**（如 OpenRouter 使用 `OPENAI_API_BASE=https://openrouter.ai/api/v1`、`OPENAI_API_KEY=<key>`）；③ **`opencode auth login`**，凭证存于 `~/.local/share/opencode/auth.json`。
  - **OpenWork 在界面上的做法**：沿用 OpenCode 的配置体系（显式配置、不依赖自动探测）；桌面端提供 **Settings**，内含 **Provider/凭证管理**——查看已连接账户、用量统计、切换账户、删除单项凭证等，用户可在界面完成授权与切换（与 OpenCode 官方桌面应用的 Settings 一致）。
  - **AIGO 建议**：在设置页增加「Provider/模型配置」说明与引导（如 opencode.json 路径、环境变量说明、或提示使用 `opencode auth login`）；后续可评估在 UI 中集成配置或授权入口，与 OpenWork 对齐体验。详见 [docs/openwork-reference.md](docs/openwork-reference.md) 与 OpenCode 文档 [Config](https://opencode.ai/docs/config)、[CLI - auth](https://opencode.ai/docs/cli/)。
- **可选：SQLite 直读**：若需要与 OpenWork 一致的会话列表性能或离线历史，可读 `~/.opencode/opencode.db`（或项目内 `.opencode/opencode.db`）的 `sessions` / `messages` 表；表结构见 openwork-reference.md。
- **可选：MCP Bridge**：若需要「权限在桌面端弹窗」「流式进度」「自定义工具（如原生文件选择）」再考虑让 AIGO 作为 MCP 服务被 OpenCode 连接；OpenWork 通过 opencode-bridge 实现。
- **可选：执行计划 / Todos**：将 OpenCode 的 todos 渲染为时间线（OpenWork 的 execution plan）；可在「消息/工具展示」之后加一子任务。
- **可选：模板**：保存并复用 prompt 模板（小工作流），后续在设置或会话入口加「模板」管理即可。

以上在实现「OpenCode Client SDK 集成」（阶段 4）时优先做 SDK + 事件订阅；SQLite / MCP / Todos / 模板 按需在 PLAN 中补具体 todo 或单独阶段。

---

## 备注

- **OpenCode 文档**：事件与插件见 [OpenCode 插件](https://www.opencodecn.com/docs/plugins)、[opencode.ai/docs/sdk](https://opencode.ai/docs/sdk/)；Skills 见 [opencode.ai/docs/skills](https://opencode.ai/docs/skills/)。
- **OpenWork 参考**：[different-ai/openwork](https://github.com/different-ai/openwork)；sidecar/安装 [Issue #121](https://github.com/different-ai/openwork/issues/121)；**基础功能与 Client 用法** → [docs/openwork-reference.md](docs/openwork-reference.md)。**模型与 Provider**：部分 free 模型可直接用，OpenRouter 等需配置或授权；OpenWork 在 Settings 中提供 Provider/凭证管理；详见 PLAN「从 OpenWork 可参考的基础功能」与 openwork-reference 6.1。
- **本地能力扩展**：阶段 7 以「默认包不增容、以 SKILL 方式出现与扩展」为原则；ffmpeg、whisper、Python/Node、agent browser 等均以 SKILL 封装，应用层只提供通用发现/配置/调用机制，便于未来兼容与独立演进。
- **Subagent 可见性**：阶段 8 解决当前会话内看不到子任务/子 agent 输出的问题，依赖 OpenCode 事件或消息结构的调研结果。
- **机器人模式（阶段 9）**：调研分三部分——① OpenClaw 的 bot、安全、IM 网管、本地文件/命令防护、授权、cron；② 结合 OpenCode 的插件/MCP/Skills、权限模型与会话模型；③ **落地技术方案与实施计划**（架构选型、组件划分、阶段与排期）。三部分结论写入设计文档（如 `docs/robot-mode-design.md`）后再拆实现任务。目标为「远程用户通过 IM 与本地 AI 协作」且安全可控。
- 每完成一个功能块，按 AGENTS.md 中的「AI 自测」要求执行自测并通过后再进入下一阶段。

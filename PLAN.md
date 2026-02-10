# 项目规划

## 目标

- 做一个基于 OpenCode 的类 OpenWork 桌面应用（ready2work）：Tauri 2.0 + React 前端，内置 OpenCode 的下载与自启动连接，完整会话/消息/工具调用展示、Skills 管理，并预留与 Vercel AI SDK 集成的评估空间。

---

## 阶段 / 里程碑

| 阶段 | 目标 | 状态 |
|------|------|------|
| 1 | Tauri 2.0 + React 客户端骨架 | 待开始 |
| 2 | OpenCode 下载与 builtin 启动、自动连接 | 待开始 |
| 3 | UI 体系：Shadcn/ui、Layout、Sidebar、Menu、Router、Icons | 待开始 |
| 4 | OpenCode Client SDK 集成：事件监听、消息/工具展示、react-markdown | 待开始 |
| 5 | Skills 管理：查看当前 skills、通过 zip 安装 | 待开始 |
| 6 | （可选）Vercel AI SDK 集成评估与落地 | 待开始 |

---

## 功能实施计划

### 1. Tauri 2.0 + React 客户端应用

参考：`create-tauri-app` 选 React + Vite + TypeScript；或社区模板 `create-tauri-react`（含 Tailwind）。

- [ ] 使用 `pnpm create tauri-app@latest`（或 `npm create tauri-app@latest`）创建项目，包名/identifier 按 ready2work 填写。
- [ ] 前端模板选择 **React**，语言选 **TypeScript**，包管理选 **pnpm**。
- [ ] 确认生成结构：`src-tauri/`（Rust）、前端根目录（如 `src/`）、`vite.config.ts`、`tauri.conf.json`。
- [ ] 配置 **ESLint** 与 **Prettier**，规则与后续 Tailwind/Shadcn 不冲突。
- [ ] 确认 `pnpm dev` 启动 Tauri 窗口并加载 Vite 开发服；`pnpm tauri build`（或等价）产出安装包。
- [ ] 预留后续 **sidecar**：确认 `tauri.conf.json` 中 resources/sidecar 配置方式，便于后续挂载 OpenCode 二进制。
- [ ] **自测**：能成功 `pnpm dev` / `pnpm tauri build` 并启动空白窗口，无报错。

---

### 2. 基于 OpenCode 的类 OpenWork 能力：下载与 builtin 启动、自动连接

参考：OpenWork 执行 `opencode serve --hostname 127.0.0.1 --port <port>`；二进制可放 Tauri sidecar 或应用数据目录。[different-ai/openwork](https://github.com/different-ai/openwork) 的 sidecar/安装见 [Issue #121](https://github.com/different-ai/openwork/issues/121)。

- [ ] **调研**：看 OpenWork 仓库中 `packages/desktop/src-tauri/sidecars`、releases 里是否带 OpenCode 二进制；记录各平台（macOS arm/x64、Windows、Linux）的下载 URL 或打包方式。
- [ ] **版本与平台**：定义「当前支持的 OpenCode 版本」（如 latest 或固定版本）；实现运行时检测 OS/arch（Tauri 或 JS 侧），决定下载哪一档二进制。
- [ ] **下载流程**：实现下载可执行文件到应用目录（如 Tauri `app_data_dir` 或 sidecar 目标路径）；带进度与失败重试；可选校验（checksum/签名）。
- [ ] **Sidecar/Command**：在 Tauri 中配置 OpenCode 为 sidecar，或从应用目录 spawn 子进程；启动命令固定为 `opencode serve --hostname 127.0.0.1 --port <port>`，端口可配置（如 4096），避免与已有进程冲突。
- [ ] **连接**：前端或 Tauri 层在「应用启动」或「连接」时，用 `@opencode-ai/sdk` 的 `createOpencodeClient({ baseUrl: "http://127.0.0.1:<port>" })` 连接；实现 **health 轮询** 与 **断线重连**（退避策略）。
- [ ] **自测**：从「本机无 OpenCode」到「下载 → 启动 serve → 客户端连接」全流程可重复；重启应用后能自动启动进程并连接成功。

---

### 3. UI：Tailwind 兼容组件库、Layout、Sidebar、Menu、Router、Icons

- [ ] 在现有 Vite+React 项目中安装 **Tailwind CSS**（`tailwindcss postcss autoprefixer`），按 v4 或 v3 官方步骤配置。
- [ ] 集成 **Shadcn/ui**：运行 `npx shadcn@latest init`，选择 New York 等风格，确保与 Tailwind 兼容；按需添加 `Button`、`Sidebar`、`Sheet`、`DropdownMenu` 等组件。
- [ ] **根 Layout**：实现根布局（主内容区 + 左侧可折叠 Sidebar）；使用 Shadcn 的 `Sidebar` 或自搭；主题变量与 Shadcn 一致（亮/暗可后续做）。
- [ ] **Sidebar 内容**：顶部或中部为 **Sessions 列表**（先占位列表，后续接 SDK）；底部或固定位置放 **设置** 入口（图标 + 文案「设置」）。
- [ ] **路由**：安装 **React Router**（如 `react-router-dom`），定义路由：`/`（欢迎或会话列表）、`/session/:id`（会话详情）、`/settings`（设置）、可选 `/skills`（Skills 管理）。
- [ ] **Menu 与高亮**：Sidebar 中「会话」「设置」「Skills」等与路由映射；当前路由高亮；点击跳转。
- [ ] **Icons**：集成 **lucide-react**（与 Shadcn 推荐一致），在 Sidebar、设置、会话项、Skills 等处统一使用；避免再引入多套图标库。
- [ ] **自测**：Layout/Sidebar/Menu/路由在 dev 与打包后均正常；点击会话占位项与设置能正确跳转；图标显示无缺失。

---

### 4. OpenCode 事件与消息展示：Client SDK、react-markdown

OpenCode 事件参考：[插件 (Plugins)](https://www.opencodecn.com/docs/plugins)（如 `session.*`、`message.updated`、`tool.execute.before`/`after`、`server.connected`）。

- [ ] 在连接成功后，使用 **@opencode-ai/sdk** 的 client 订阅/轮询 **会话列表**（若 SDK 或后端提供 list sessions API）；与 Sidebar 的 Sessions 列表状态同步（新建、切换、删除）。
- [ ] **会话详情**：进入 `/session/:id` 时加载该会话的消息列表；区分 **用户消息** 与 **AI 消息**；若 SDK 支持流式，则对接流式更新并实时追加到 UI。
- [ ] **Markdown 渲染**：安装 **react-markdown**；对 AI 消息内容用 react-markdown 渲染；配置 `remark-gfm`（表格、脚注等）、代码块高亮（如 `rehype-highlight` 或 `react-syntax-highlighter`）；防止 XSS（使用默认安全行为或 sanitize）。
- [ ] **工具调用展示**：订阅或从消息上下文中拿到 `tool.execute.before`/`after` 等；在消息下方或右侧面板以列表/时间线形式展示「工具名、参数、结果/状态」。
- [ ] **流式订阅**：使用 `client.event.subscribe()` 订阅 SSE；先订阅再 `client.session.prompt()`，在回调中处理 `message.part.updated` 等事件并按 sessionID 更新当前会话 UI（参考 [docs/openwork-reference.md](docs/openwork-reference.md)）。
- [ ] **Session Artifacts（产出/修改文件列表）**：在会话内展示本 session 涉及的 **artifacts**——即本轮对话中**被创建或修改的文件**。数据来源：从工具调用中汇总（如 `edit`、`write`、`patch` 等工具的参数中的文件路径），或从事件流中的 `file.edited`、`file.watcher.updated` 等（若 SDK/服务端暴露）按 session 聚合。在会话页用**列表/面板**展示：文件路径、操作类型（新建/修改）、可选时间或顺序；支持点击在编辑器中打开或定位（若后续集成）。详见 [docs/openwork-reference.md](docs/openwork-reference.md) 中「文件与 Artifacts」。
- [ ] **自测**：创建会话、发消息、触发工具调用后，会话列表、消息内容（含 Markdown）、工具调用展示正确；流式无错乱；**产出的文件在 Artifacts 列表中正确列出**（新建/修改可区分）。

---

### 5. Skills 管理：查看当前检索到的 skills、通过 zip 安装

OpenCode 会在多路径下检索 `SKILL.md`：[Agent Skills](https://opencode.ai/docs/skills/)  
- 项目：`.opencode/skills/<name>/SKILL.md`、`.claude/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md`  
- 全局：`~/.config/opencode/skills/<name>/SKILL.md`、`~/.claude/skills/`、`~/.agents/skills/`  
每个 skill 为目录，内含 `SKILL.md`，且需 YAML frontmatter：`name`（必填）、`description`（必填）。OpenWork 有 Skills Manager：列表展示、从包安装、导入本地目录；可参考 [different-ai/openwork](https://github.com/different-ai/openwork)。

- [ ] **Skills 页面**：在路由中增加 **Skills 管理** 页（如 `/skills`），Sidebar 增加入口（图标 + 「Skills」）。
- [ ] **「当前检索到的 skills」**：实现「当前会被 OpenCode 检索到的 skills」列表。若 SDK/服务端有 list skills API 则直接调用；否则在前端或通过 Tauri 读取上述目录（优先当前工作区 `.opencode/skills`、`.claude/skills`、`.agents/skills`，以及用户目录 `~/.config/opencode/skills` 等），扫描子目录内是否存在 `SKILL.md`，解析 frontmatter 取 `name`、`description`，去重后展示（可标注来源：项目/全局）。
- [ ] **列表 UI**：表格或卡片展示 skill 的 name、description、路径/来源；支持按名称搜索或筛选。
- [ ] **通过 zip 安装**：提供「从 zip 安装」入口（如按钮 + 文件选择）。选择 zip 后：由 Tauri 或前端解压到目标目录（建议全局：`~/.config/opencode/skills/<skill-name>/`，或由用户选「当前项目」则解压到当前工作区 `.opencode/skills/<skill-name>/`）；解压后目录内必须包含 `SKILL.md`，且 frontmatter 含 `name`、`description`，否则提示安装失败并清理不完整目录；安装成功后刷新「当前检索到的 skills」列表。
- [ ] **zip 格式约定**：文档或 UI 中说明：zip 内应为「单层目录且内含 SKILL.md」或「根目录即 SKILL.md」；安装时以 frontmatter 的 `name` 作为目录名（若 zip 根目录名与 name 不一致则按 name 创建目录）。
- [ ] **自测**：在空目录下「当前 skills」为空或仅系统默认；放入一个合法 skill 目录后列表出现该 skill；用 zip（含 SKILL.md + 合法 frontmatter）安装后列表更新且 OpenCode 能检索到；非法 zip 或缺少 SKILL.md 时提示错误且不破坏已有 skills。

---

### 6. （可选）Vercel AI SDK 集成评估

- [ ] **调研**：阅读 [Vercel AI Gateway - OpenCode](https://vercel.com/docs/ai-gateway/opencode)、`ai-sdk-provider-opencode-sdk`（若有），确认与当前「@opencode-ai/sdk + 事件订阅」架构是否冲突（协议、流格式、工具调用格式）。
- [ ] **决策**：若兼容，则规划在哪些能力上引入 AI SDK（如统一 stream、useChat）；若冲突，则在文档中记录「暂不采用 AI SDK」及原因。
- [ ] **自测**：若集成，验证流式输出、工具调用在 AI SDK 与 OpenCode 并存时行为正确。

---

## 从 OpenWork 可参考的基础功能（OpenCode Client 使用等）

OpenWork 与 OpenCode 的通信方式、API 用法、可选方案已整理到 **[docs/openwork-reference.md](docs/openwork-reference.md)**，实现阶段可直接对照。此处仅列与「基础功能」相关的、可拆成任务或决策点的项。

- **HTTP API + SDK（必用）**
  - 使用 `createOpencodeClient({ baseUrl })` 连接；`client.session` 做会话 CRUD；`client.session.prompt()` 发消息（同步）。
  - 使用 **`client.event.subscribe()`** 订阅 SSE，处理 `message.part.updated` 等实现流式对话；健康检查用 `client.global.health()`，用于重连与状态展示。
- **流式对话**：先 `event.subscribe()` 再 `session.prompt()`，在回调里按 `sessionID` 过滤并更新 UI（与 OpenWork 一致）。
- **可选：SQLite 直读**：若需要与 OpenWork 一致的会话列表性能或离线历史，可读 `~/.opencode/opencode.db`（或项目内 `.opencode/opencode.db`）的 `sessions` / `messages` 表；表结构见 openwork-reference.md。
- **可选：MCP Bridge**：若需要「权限在桌面端弹窗」「流式进度」「自定义工具（如原生文件选择）」再考虑让 ready2work 作为 MCP 服务被 OpenCode 连接；OpenWork 通过 opencode-bridge 实现。
- **可选：执行计划 / Todos**：将 OpenCode 的 todos 渲染为时间线（OpenWork 的 execution plan）；可在「消息/工具展示」之后加一子任务。
- **可选：模板**：保存并复用 prompt 模板（小工作流），后续在设置或会话入口加「模板」管理即可。

以上在实现「OpenCode Client SDK 集成」（阶段 4）时优先做 SDK + 事件订阅；SQLite / MCP / Todos / 模板 按需在 PLAN 中补具体 todo 或单独阶段。

---

## 备注

- **OpenCode 文档**：事件与插件见 [OpenCode 插件](https://www.opencodecn.com/docs/plugins)、[opencode.ai/docs/sdk](https://opencode.ai/docs/sdk/)；Skills 见 [opencode.ai/docs/skills](https://opencode.ai/docs/skills/)。
- **OpenWork 参考**：[different-ai/openwork](https://github.com/different-ai/openwork)；sidecar/安装 [Issue #121](https://github.com/different-ai/openwork/issues/121)；**基础功能与 Client 用法** → [docs/openwork-reference.md](docs/openwork-reference.md)。
- 每完成一个功能块，按 AGENTS.md 中的「AI 自测」要求执行自测并通过后再进入下一阶段。

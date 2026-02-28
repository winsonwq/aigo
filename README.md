# AIGO

基于 OpenCode 的类 OpenWork 桌面应用（Tauri 2 + React），便于快速开工与协作。

## 快速开始

**安装依赖**：本项目使用 **pnpm**。若使用 `npm i` 遇到 `Cannot read properties of null (reading 'matches')`，属 npm 已知问题，请改用 pnpm。未安装 pnpm 时可执行：`corepack enable && corepack prepare pnpm@latest --activate`（Node 自带 corepack）。镜像已在 `.npmrc` 中配置为 npmmirror。

```bash
pnpm install
pnpm dev          # 仅前端（Vite，http://localhost:1420）
pnpm tauri dev    # 桌面应用（会先执行 pnpm dev，再编译并启动 Rust）
pnpm run build    # 前端构建
pnpm tauri build  # 打包桌面应用
```

**若 `pnpm tauri dev` 看起来停住**：会先跑 `pnpm dev` 再跑 `cargo run`。Rust **首次编译**可能要 1～2 分钟，期间终端可能几乎没有新输出，属正常。若卡在「Running BeforeDevCommand」之后很久：可先单独开一个终端执行 `pnpm dev`，确认能出现 `Local: http://localhost:1420`；若 Vite 正常，再回到原终端多等一会儿（等 Rust 编译）。若卡在「Running DevCommand」之后：就是在编译 Rust，多等 1～2 分钟即可。

## 文档

详见 [AGENTS.md](AGENTS.md) 中的文档索引。

**使用已打包应用时**：若要在应用内使用 Skills 搜索、从 GitHub 等来源安装或卸载 Skill，本机需提前安装 [Node.js（含 npx）与 Git](docs/user-environment.md)；仅「从 zip 安装」则不需要。详见 [docs/user-environment.md](docs/user-environment.md)。

## IDE

推荐 [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)。

## pnpm store 位置

项目内已通过 `.npmrc` 配置 `store-dir=~/.pnpm-store`，依赖会装到用户目录，不占用项目下的 `.pnpm-store`。若项目里已有 `.pnpm-store`，可删除后重新执行 `pnpm install`。

## OpenCode 连接说明

- **打包后的应用已内置 OpenCode**：执行 `pnpm tauri build` 时会在构建前自动下载当前平台的 OpenCode CLI 到 `src-tauri/binaries/` 并随应用一起打包，用户安装后无需再单独安装 opencode。
- 应用内点击「连接」会优先使用**内置的 OpenCode** 启动 `opencode serve`；若未打包进 sidecar（例如仅 `pnpm tauri dev` 且未事先下载），则回退到本机 PATH 上的 `opencode`。
- 若需**单独下载** OpenCode 二进制（例如在未联网环境先在一台机器上下载再拷贝）：`pnpm run download-opencode`（可选版本：`node scripts/download-opencode.mjs 1.2.10`）。
- **若你已手动启动了 opencode serve**，在 Tauri 窗口里仍连不上，多半是 **CORS**：请用 `--cors` 指定前端来源后重启 serve，例如：
  ```bash
  opencode serve --hostname 127.0.0.1 --port 4096 --cors http://localhost:1420 --cors tauri://localhost
  ```
- 连接其他 opencode 服务时的认证（如密码）见 [PLAN.md](PLAN.md) 阶段 2 的「（后续）连接其他 OpenCode 服务与认证」。
- **内置 OpenCode 如何测试**：见 [docs/testing-opencode-sidecar.md](docs/testing-opencode-sidecar.md)（开发/打包、有 sidecar/无 sidecar 等场景）。

## Rust 版本说明

若 `pnpm tauri dev` 报错 `rustc 1.86.0 is not supported ... time requires rustc 1.88.0`，可二选一：

1. **升级 Rust**：`rustup update` 到 1.88+ 后再运行。
2. **保持当前 Rust**：在项目根执行一次依赖降级后即可正常编译：
   ```bash
   cd src-tauri && cargo update -p time --precise 0.3.45 && cargo update -p time-core --precise 0.1.7 && cargo update -p time-macros --precise 0.2.25
   ```

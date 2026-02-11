# ready2work

基于 OpenCode 的类 OpenWork 桌面应用（Tauri 2 + React），便于快速开工与协作。

## 快速开始

```bash
pnpm install
pnpm dev          # 仅前端
pnpm tauri dev    # 桌面应用（需 Rust 环境）
pnpm run build    # 前端构建
pnpm tauri build  # 打包桌面应用
```

## 文档

详见 [AGENTS.md](AGENTS.md) 中的文档索引。

## IDE

推荐 [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)。

## pnpm store 位置

项目内已通过 `.npmrc` 配置 `store-dir=~/.pnpm-store`，依赖会装到用户目录，不占用项目下的 `.pnpm-store`。若项目里已有 `.pnpm-store`，可删除后重新执行 `pnpm install`。

## OpenCode 连接说明

- 应用内点击「连接」会先尝试连接本机已运行的 OpenCode（默认 `http://127.0.0.1:4096`）；若连不上再尝试启动 `opencode serve`。
- **若你已手动启动了 opencode serve**，在 Tauri 窗口里仍连不上，多半是 **CORS**：浏览器会拦截跨域请求。请用 `--cors` 指定前端来源后重启 serve，例如：
  ```bash
  opencode serve --hostname 127.0.0.1 --port 4096 --cors http://localhost:1420 --cors tauri://localhost
  ```
  开发时 Vite 一般为 `http://localhost:1420`；打包后 Tauri 可能用 `tauri://localhost`，按需添加。
- 连接其他 opencode 服务时的认证（如密码）见 [PLAN.md](PLAN.md) 阶段 2 的「（后续）连接其他 OpenCode 服务与认证」。

## Rust 版本说明

若 `pnpm tauri dev` 报错 `rustc 1.86.0 is not supported ... time requires rustc 1.88.0`，可二选一：

1. **升级 Rust**：`rustup update` 到 1.88+ 后再运行。
2. **保持当前 Rust**：在项目根执行一次依赖降级后即可正常编译：
   ```bash
   cd src-tauri && cargo update -p time --precise 0.3.45 && cargo update -p time-core --precise 0.1.7 && cargo update -p time-macros --precise 0.2.25
   ```

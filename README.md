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

## Rust 版本说明

若 `pnpm tauri dev` 报错 `rustc 1.86.0 is not supported ... time requires rustc 1.88.0`，可二选一：

1. **升级 Rust**：`rustup update` 到 1.88+ 后再运行。
2. **保持当前 Rust**：在项目根执行一次依赖降级后即可正常编译：
   ```bash
   cd src-tauri && cargo update -p time --precise 0.3.45 && cargo update -p time-core --precise 0.1.7 && cargo update -p time-macros --precise 0.2.25
   ```

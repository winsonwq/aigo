# OpenCode 内置（Sidecar）测试说明

用于验证「下载 → 打包 → 优先 sidecar 启动」全流程是否正常。

---

## 前置条件

- 已安装 Node.js、pnpm、Rust（`rustc`/`cargo`）、Tauri CLI（`pnpm tauri` 可用）
- **测试打包版时**：本机可先**不**安装 OpenCode（`which opencode` 可无），以验证「仅靠内置即可连接」

---

## 1. 仅开发模式（无 sidecar，走 PATH）

**目的**：确认在未下载 sidecar 时，应用能回退到本机 PATH 上的 opencode。

1. 确保本机已安装 OpenCode（如 `brew install anomalyco/tap/opencode`），且 `opencode --version` 能跑通。
2. **不要**执行 `pnpm run download-opencode`（保持 `src-tauri/binaries/` 无 opencode 或为空）。
3. 启动开发：
   ```bash
   pnpm tauri dev
   ```
4. 应用打开后应出现「未连接 OpenCode」或自动开始连接。
5. 点击「连接 OpenCode」。
6. **预期**：状态变为「已连接」，侧栏出现「会话历史」，可新建会话并发消息（说明走的是 PATH 上的 opencode）。

若本机**未**安装 opencode：应看到明确错误（如「Failed to start opencode serve: ...」或界面上的黄色错误文案），且 Console 有 `[OpenCode] start_opencode_serve failed: ...`。

---

## 2. 开发模式（有 sidecar）

**目的**：确认已下载的 sidecar 在 dev 时会被优先使用。

1. 下载当前平台 OpenCode 到 sidecar 目录：
   ```bash
   pnpm run download-opencode
   ```
2. 确认生成文件（示例为 macOS ARM）：
   ```bash
   ls -la src-tauri/binaries/
   # 应看到 opencode-aarch64-apple-darwin（或你当前 target）
   ```
3. 启动开发：
   ```bash
   pnpm tauri dev
   ```
4. 点击「连接 OpenCode」。
5. **预期**：能连接成功；Console 可看到 `[OpenCode] start_opencode_serve ok, polling health…` 与 `[OpenCode] Connected.`（此时用的是 sidecar，不是 PATH）。

可选：临时把 opencode 从 PATH 里拿掉（改 PATH 或重命名本机 opencode），再重复 3–5，确认仍能连接，即证明走的是 sidecar。

---

## 3. 打包版（内置 OpenCode，无需本机安装）

**目的**：验证用户「只装 AIGO、不装 opencode」也能正常连接。

1. 在**未**安装 OpenCode 的机器上测试，或在本机临时从 PATH 移除 opencode。
2. 打桌面包（会先执行 `download-opencode.mjs` 再 build）：
   ```bash
   pnpm tauri build
   ```
3. 安装并运行生成的安装包：
   - macOS：打开 `src-tauri/target/release/bundle/dmg/*.dmg` 安装后启动 AIGO。
   - Windows：运行 `src-tauri/target/release/bundle/nsis/*.exe` 或 msi 安装后启动。
4. 启动后点击「连接 OpenCode」。
5. **预期**：能连接成功，可新建会话、发消息；无需在本机安装 opencode。

若失败：打开应用内开发者工具（若已默认打开），看 Console 中 `[OpenCode]` 的日志；若为「Failed to start bundled OpenCode」则多为 sidecar 未正确打包或权限问题。

---

## 4. 下载脚本单独测试

**目的**：确认下载脚本在不同版本/平台下的行为。

```bash
# 使用默认版本（package.json opencodeVersion 或 1.2.10）
pnpm run download-opencode

# 指定版本
node scripts/download-opencode.mjs 1.2.9

# 使用 latest（需能访问 GitHub API）
node scripts/download-opencode.mjs latest

# 强制重新下载
node scripts/download-opencode.mjs --force
```

检查 `src-tauri/binaries/` 下是否出现 `opencode-<target-triple>`（Windows 带 `.exe`），且该文件可执行（Unix 上 `chmod +x` 已由脚本设置）。

---

## 5. 快速检查清单

| 场景 | 操作 | 预期 |
|------|------|------|
| dev，无 sidecar，有 PATH opencode | `pnpm tauri dev` → 连接 | 已连接，走 PATH |
| dev，有 sidecar | `pnpm run download-opencode` → `pnpm tauri dev` → 连接 | 已连接，走 sidecar |
| 打包后，本机无 opencode | `pnpm tauri build` → 安装并打开应用 → 连接 | 已连接，仅靠内置 |
| 下载脚本 | `pnpm run download-opencode` | `binaries/opencode-*` 存在且可执行 |

---

## 常见问题

- **打包时提示 resource path `binaries/opencode-xxx` doesn't exist**  
  说明构建前未成功下载。先在本机执行一次 `pnpm run download-opencode`（需网络），再执行 `pnpm tauri build`。

- **连接时报 CORS / 网络被拦截**  
  内置 opencode 已带 `--cors tauri://localhost` 和 `https://asset.localhost`。若仍报错，看 Console 里 `[OpenCode]` 的完整错误信息，确认是否为其他 origin 或端口问题。

- **想固定 OpenCode 版本**  
  在 `package.json` 中设置 `"opencodeVersion": "1.2.10"`（或目标版本），构建前脚本会优先使用该版本。

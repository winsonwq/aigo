# 用户环境准备说明

本文档说明**使用 AIGO 桌面应用**（Agent 工具执行、安装/使用 Skills、连接 OpenCode 等）时，本机需要提前准备的环境，便于用户一次性准备好依赖，避免工具调用或 Skills 相关操作报错。

---

## 产品目标：打包时内置运行时

**原因**：Agent 工具天生依赖代码运行时（Node、Git、Python、pip 等）才能更灵活地完成任务——执行脚本、克隆仓库、安装依赖、调用 CLI 等。打包时准备这些必备内容，**不是为了仅仅 Skills**，而是为了支撑所有依赖这些运行时的 Agent 工具。

**期望行为**：在打包各平台应用（macOS / Windows / Linux）时，将 **Node.js**、**Git**（或通过 Rust git2 实现克隆，不内置 Git CLI）、**Python**、**pip** 等系统代码运行时一并打包进安装包，使用户**下载安装后即可开箱使用**，无需本机预装。运行时的准备与内置方案见设计文档 [docs/design-runtime-bundling.md](design-runtime-bundling.md)。

在**尚未完成内置**之前，按下方表格准备本机环境；完成内置后，仅「网络」等仍可能依赖本机条件。

---

## 一、按功能区分所需环境（当前 / 未内置前）

| 功能 | 是否需要 Node.js | 是否需要 Git | 是否需要网络 | 说明 |
|------|------------------|--------------|--------------|------|
| 运行 AIGO 应用 | 否 | 否 | 否（仅启动） | 打包后的应用为独立可执行，无需 Node/Git。 |
| 连接 OpenCode（内置） | 否 | 否 | 否 | 应用已内置 OpenCode 二进制，无需本机安装。 |
| **Skills：从 zip 安装** | 否 | 否 | 否 | 本地选择 zip 文件解压到技能目录，不依赖 Node/Git。 |
| **Skills：搜索（skills.sh）** | **是** | 否 | **是** | 搜索调用 `npx skills find`，需要本机有 Node.js 与 npx（内置后无需）。 |
| **Skills：从来源安装**（owner/repo 或 URL） | **是** | **是** | **是** | 安装调用 `npx skills add` 或 Rust git2 克隆（内置后无需本机 Git）。 |
| **Skills：卸载** | **是** | 否 | 否 | 卸载调用 `npx skills remove`（内置 Node 后无需本机）。 |

结论：若用户**只使用「从 zip 安装」**，则不需要 Node 和 Git；若使用**搜索、从来源安装或卸载**，则需要 **Node.js（含 npx）** 和 **Git**（仅“从来源安装”需要）。**打包内置运行时完成后**，上述功能将不再依赖本机 Node/Git/Python。

---

## 二、各环境说明

### 1. Node.js（含 npx）

- **用途**：Skills 的搜索（`npx skills find`）、从来源安装（`npx skills add`）、卸载（`npx skills remove`）均通过系统 PATH 调用 `npx`。
- **建议版本**：当前 LTS（如 18.x / 20.x）。npx 随 Node 安装，无需单独安装。
- **如何确认**：终端执行 `node -v` 与 `npx -v` 能输出版号即可。
- **注意**：从图形界面（如 macOS .app）启动时，应用会尝试从登录 shell 的 PATH 中查找 `npx`（如通过 nvm/fnm 安装的 Node），若本机未装 Node 或 npx 不在 PATH 中，搜索/安装/卸载会失败，并提示：“请确认已安装 Node.js 与 npx，并检查网络后重试。”  

**安装指引**（任选其一）：

- 官网安装包：[nodejs.org](https://nodejs.org/)
- 版本管理：`nvm`、`fnm`、`volta` 等（安装后确保在默认 shell 的 profile 中配置了 PATH，以便桌面应用能找到 `npx`）

### 2. Git

- **用途**：仅在使用「从来源安装」时用到。`npx skills add <owner/repo>` 或仓库 URL 时，底层会通过 Git 克隆远程仓库到本机技能目录。
- **如何确认**：终端执行 `git --version` 能输出版号即可。
- **安装指引**：
  - macOS：Xcode Command Line Tools（`xcode-select --install`）或 [git-scm.com](https://git-scm.com/)
  - Windows： [git-scm.com](https://git-scm.com/) 或 winget：`winget install Git.Git`
  - Linux：包管理器安装 `git`（如 `apt install git` / `dnf install git`）

### 3. 网络

- **搜索**：请求 skills.sh 的搜索 API，需要能访问外网。
- **从来源安装**：需要能访问 GitHub（或对应 Git 托管）拉取仓库。
- **从 zip 安装 / 卸载**：不需要网络。

---

## 三、快速自检清单

使用前可在终端执行以下命令自检：

```bash
# Node.js 与 npx（Skills 搜索/安装/卸载需要）
node -v   # 应输出版号，如 v20.x.x
npx -v    # 应输出版号

# Git（仅「从来源安装」需要）
git --version   # 应输出版号
```

若仅使用「从 zip 安装」Skills，可不安装 Node 与 Git；若使用搜索或从 GitHub 等来源安装，建议两者都安装并保证在 PATH 中可用。

---

## 四、与开发环境的区别

- **开发 AIGO 项目**（如 `pnpm install`、`pnpm tauri dev`）：需要 Node.js、pnpm、Rust 等，见项目根目录 [README.md](../README.md)。
- **仅使用已打包的 AIGO 应用**：按上表准备即可；若不用搜索/从来源安装/卸载，则无需 Node 与 Git。

## 五、打包内置运行时（目标：开箱即用）

运行时的准备与打包内置方案（Node、Git/git2、Python、pip）见**设计文档** [docs/design-runtime-bundling.md](design-runtime-bundling.md)。完成实施后，用户下载安装即可在各种 Agent 工具调用及 Skills 场景下使用上述运行时，无需本机预装。

**当前**：Node/Git/Python 暂时不内置（见设计文档 1.1）。未内置期间除按上文自检与安装指引准备本机环境外，也可借助**引导环境的 Skill**，例如 [environment-setup-guide](https://skills.sh/sickn33/antigravity-awesome-skills/environment-setup-guide)（skills.sh），由 AI 按平台给出 Node.js、Python、Git 的安装与验证步骤。

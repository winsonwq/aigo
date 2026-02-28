# 运行时准备与内置（设计文档）

本文档为**打包时运行时的准备与内置**的唯一设计文档：如何在打包各平台应用时把 **Node.js**、（可选）**Git** 或 **Rust git2**、以及（可选）**Python / pip** 等系统代码运行时一并准备并打包进 AIGO。

**为何要打包这些运行时**：Agent 工具天生依赖代码运行时（Node、Git、Python 等）才能更灵活地完成任务——执行脚本、克隆仓库、安装依赖、调用 CLI 等。打包时内置这些运行时，是为了让用户**下载安装后即可开箱使用**，不依赖本机是否已装对应环境。Skills 的搜索/从来源安装/卸载、以及依赖 Python 的 Skill，只是其中一类使用场景；更根本的是支撑**任意 Agent 工具**对 Node/Git/Python 等运行时的调用需求。用户侧说明见 [user-environment.md](user-environment.md)。

---

## 一、现状与目标

- **现状**：当前 Skills 的搜索/从来源安装/卸载依赖本机 `npx`（Node.js）与 Git；部分 Skill 依赖 **Python**。更广泛地，Agent 在执行工具调用（跑脚本、git 操作、pip 等）时也依赖这些运行时。
- **目标**：**打包各平台应用时**在安装包内自带 Node.js、Git 或 git2、Python、pip 等运行时，使 Agent 工具与 Skills 均能开箱即用，无需用户本机预装。

### 1.1 当前决策（暂定）与设想

- **当前决策**：Node.js / Git / Python 等运行时**暂时不内置**，具体方案与实施顺序尚未最终确定（与 OpenWork 一致：OpenWork 仅内置/回退 OpenCode 引擎，不负责 Node/Git/Python）。在未内置期间，依赖用户本机环境或「引导用户安装」类能力。
- **设想：不内置时的替代——引导用户安装**
  - 应用内可在首次使用相关功能前做**环境检测**（如 `npx`/`git`/`python` 是否在 PATH），缺失时在 UI 中提示安装步骤或跳转 [user-environment.md](user-environment.md)。
  - 已有**引导环境的 Skill** 可复用：例如 [environment-setup-guide](https://skills.sh/sickn33/antigravity-awesome-skills/environment-setup-guide)（sickn33/antigravity-awesome-skills），提供 Node.js、Python、Git 等分平台安装指引与版本检查（`node -v` / `python -v` / `git -v`），用户按指引安装后可满足 Skills 搜索/从来源安装及依赖 Python 的 Skill 的需求。后续可评估在 onboarding 或设置中推荐该 Skill，或集成类似指引。
  - 若未来采用「内置」方案，则本文档第二～八节的方案与实施顺序仍可直接执行。

---

## 二、方案概览

| 方案 | Node.js | Git | 体积影响 | 实现难度 | 说明 |
|------|---------|-----|----------|----------|------|
| A. 内置 Node 二进制 + Rust 做 clone | 内置 | 不内置（用 Rust git2） | +约 50～80MB/平台 | 中 | 体积最小；需在 Rust 实现 git2 clone 并兼容 skills add 后续逻辑 |
| B. 内置 Node + 内置 Git 二进制 | 内置 | 内置 | +约 80～120MB/平台 | **中（更统一）** | **统一简单**：下载 Node+Git → 运行时 PATH 前置 → 仍用 npx/git，无需 Rust git2；多约 30～40MB |
| C. Node 侧边二进制（pkg 打包“skills” CLI） | 内置（单可执行文件） | 可选 git2 或内置 Git | 视 pkg 产物而定 | 高 | 需把 skills 及其依赖打成单一可执行文件，且 add 仍依赖 clone |

**选用建议**：在 **APP 体积增加可接受**（多约 30～40MB 为 Git）的前提下，**方案 B 更统一、实现更简单**——构建侧只需多一份 Git 下载/解压脚本（与 Node 同模式），运行侧统一为「把内置 Node 与 Git 的 bin 前置到 PATH，再执行现有 npx/git 命令」，无需引入 Rust git2 或复刻 `skills add` 的 clone 后逻辑。若严格控体积，选方案 A。下面先按方案 A、再按方案 B 展开实现思路。

---

## 三、如何准备这些运行时（构建前）

打包前需要按**目标平台**（Tauri 的 target triple）下载对应运行时，解压到 `src-tauri/binaries/`，并在 `tauri.conf.json` 中配置打包进安装包。流程与现有 OpenCode 一致，可参考 `scripts/download-opencode.mjs`（用 `TAURI_ENV_TARGET_TRIPLE` 或 `rustc --print host-tuple` 取目标，下载 → 解压 → 重命名为 `binaries/<name>-<target>`）。

### 3.0 目标 triple 与脚本约定

- **获取 target**：与 `download-opencode.mjs` 相同：优先 `process.env.TAURI_ENV_TARGET_TRIPLE`，否则 `rustc --print host-tuple`，再否则按 `process.platform` / `process.arch` 推断（darwin/linux/win32 × arm64/x64）。
- **输出目录**：统一放到 `src-tauri/binaries/`，子目录或命名建议：
  - Node：`binaries/node-<target>/`（内含 `bin/node`、`bin/npx` 等）
  - Git（方案 B）：`binaries/git-<target>/`（内含 `bin/git` 或 Windows 的 `cmd/git.exe`）
  - Python：`binaries/python-<target>/`（内含 `bin/python` / `python.exe`，可选 pip）
- **构建入口**：在 `beforeBuildCommand` 中依次调用下载脚本，例如：  
  `node scripts/download-opencode.mjs && node scripts/download-node.mjs && node scripts/download-python.mjs && pnpm build`  
  各脚本内部根据 target 判断是否支持、是否已存在（可加 `--force` 强制重新下载）。

### 3.1 Node.js

- **来源**：[https://nodejs.org/dist/](https://nodejs.org/dist/) 官方预编译包。
- **版本**：建议固定 LTS（如 v20.x），在脚本或 `package.json` 的 `nodeVersion` 中配置。
- **各平台下载路径规律**（以 v20.18.0 为例）：
  - **macOS arm64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-arm64.tar.gz`
  - **macOS x64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-x64.tar.gz`
  - **Linux x64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz`
  - **Linux arm64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-arm64.tar.xz`
  - **Windows x64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip`
  - **Windows arm64**：`https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-arm64.zip`
- **准备步骤**：脚本内根据 target 映射到上述 URL → 下载到临时文件 → 解压（tar.gz/tar.xz 用 `tar -xzf`/`tar -xJf`，zip 用 unzip）→ 将解压后的目录（如 `node-v20.18.0-darwin-arm64`）整体移动到 `binaries/node-<target>/`，保证最终存在 `binaries/node-<target>/bin/npx` 和 `bin/node`（Windows 为 `bin\npx.cmd`、`node.exe`）。
- **Tauri 打包**：在 `tauri.conf.json` 的 `bundle.resources` 中加入 `binaries/node-<target>`（或打包成 zip 在首次运行时解压到 app_data_dir，再使用解压后的路径）。

### 3.2 Git（仅方案 B 需要）

- **来源**：各平台需单独准备。
  - **Windows**：[Git for Windows](https://git-scm.com/download/win) 便携/独立包，或 [git-scm.com](https://git-scm.com/) 安装包解压提取 `bin` 目录；约 40～80MB。
  - **macOS**：Xcode Command Line Tools 中的 git 不易单独抽取；可用 [官方预编译](https://git-scm.com/download/mac) 或自建脚本从某 URL 下载已编译好的 git 二进制到 `binaries/git-<target>/bin/git`。
  - **Linux**：静态编译 git 或从发行版包中提取（如 `apt download git` 后解压 deb）；需区分 arch（x64/arm64）。
- **准备步骤**：为每个支持的 target 准备一个获取方式（下载 URL 或本地构建），解压/复制到 `binaries/git-<target>/`，确保该目录下可执行 `git --version`（通常需 `bin/git` 或 Windows 的 `cmd/git.exe` 并带上依赖的 dll）。
- **打包**：`bundle.resources` 包含 `binaries/git-<target>`；运行时在调用 `npx skills add` 前把 `PATH` 设为 `resource_dir()/git-<target>/bin` + 原 PATH。

### 3.3 Python 与 pip

- **来源**：
  - **Windows**：[python.org 可嵌入包](https://www.python.org/downloads/windows/)（如 `python-3.12.x-embed-amd64.zip`），体积小（约 7～15MB）；默认无 pip，需用 [get-pip.py](https://bootstrap.pypa.io/get-pip.py) 在解压目录中安装 pip（或构建时执行一次）。
  - **macOS**：python.org 的 macOS 安装包或 [官方 standalone build](https://www.python.org/downloads/macos/)，解压得到 `bin/python3`；需区分 x64/arm64，约 30～50MB。
  - **Linux**：官方源码编译或第三方 minimal/static build；约 20～40MB。
- **准备步骤**：脚本根据 target 下载对应 Python 包 → 解压到 `binaries/python-<target>/`，保证存在 `bin/python` 或 `python.exe`（Windows embed 目录结构可能无 `bin`，直接根目录 `python.exe`）。若需 pip：Windows 在解压目录运行 `get-pip.py`（或把 pip 作为独立资源一并打包）；macOS/Linux 通常自带或需在构建脚本里安装到该目录。
- **打包**：`bundle.resources` 包含 `binaries/python-<target>`（或 zip 首次运行时解压）。
- **pip 依赖**：Skill 若需第三方库，可约定用内置 Python 在应用数据目录下建 venv，再在该 venv 内 `pip install`；或由应用在固定子目录维护一个共用 venv。

### 3.4 小结

| 运行时 | 准备方式 | 脚本参考 | 配置 |
|--------|----------|----------|------|
| Node.js | 从 nodejs.org/dist 按 target 下载 tar.gz/tar.xz/zip，解压到 `binaries/node-<target>/` | 同 `download-opencode.mjs` 的 target 与下载/解压逻辑 | `bundle.resources` 或首次解压 |
| Git | 各平台单独下载/构建，解压到 `binaries/git-<target>/` | 需维护各平台 URL 或构建步骤 | `bundle.resources`，运行时前置 PATH |
| Python | 从 python.org 按平台取 embed/installer/static，解压到 `binaries/python-<target>/` | 同上，Windows 可加 get-pip.py | `bundle.resources` 或首次解压 |
| pip | Windows：get-pip.py；macOS/Linux：随 Python 或单独安装到同一目录 | 写入构建脚本或首次运行逻辑 | 与 Python 同目录 |

实现时建议先写 `scripts/download-node.mjs`（与 download-opencode.mjs 同风格），再按需加 `download-python.mjs`、Git 的下载或构建脚本。

---

## 四、推荐方案 A：内置 Node + Rust 做 clone（不内置 Git）

### 4.1 Node.js 内置

**思路**：构建时按目标平台下载官方 Node LTS 二进制，解压到资源目录并随应用一起打包；运行时优先使用该 Node 的 `node`/`npx`，找不到再回退到系统 PATH。

- **构建**：
  - 在 `beforeBuildCommand` 中增加一步（或独立脚本）：按 `TAURI_ENV_TARGET_TRIPLE`（或等价方式）下载 [nodejs.org/dist](https://nodejs.org/dist/) 对应平台的压缩包（如 Linux x64 `.tar.xz`、macOS/Windows 官方包），解压到例如 `src-tauri/binaries/node-<target>/`。
  - 在 `tauri.conf.json` 的 `bundle.resources` 中把该目录（或打包成 zip 再在首次运行时解压）包含进去；若 Tauri 支持目录资源则直接包含目录。
- **运行时**：
  - 在现有 `find_npx_binary()` / `find_npx_in_path()` 前增加：若存在 `resource_dir()/node-<target>/bin/npx`（或解压后的路径），则优先返回该路径；否则再走当前“系统 PATH + login shell”逻辑。
  - 调用 `npx skills find`、`npx skills add`、`npx skills remove` 时，使用该优先路径，并保持当前传参与工作目录逻辑不变。

**体积**：每个平台约 +50～80MB（Node 官方预编译包）。

**注意**：若以 zip 形式打包，需在首次运行或首次使用 Skills 前解压到应用数据目录，再使用解压后的 `bin/npx`，避免只读安装目录的权限问题。

### 4.2 “从来源安装”不用 Git CLI：用 Rust 的 git2 做 clone

**思路**：“从来源安装”在底层改为：用 Rust 的 `git2` 把仓库 clone 到技能目录，其余逻辑（目录结构、与 OpenCode 的对接）尽量与当前 `npx skills add` 行为一致；若 `skills add` 在 clone 后还有固定步骤（如写某配置文件），可在 Rust 里复刻或保留一次性的轻量 Node 调用。

- **依赖**：在 `src-tauri/Cargo.toml` 中增加 `git2`（及系统依赖 `libgit2`；Windows 可用 `libgit2-sys` 的 vendored 构建）。
- **实现**：
  - 新增 Tauri 命令，例如 `clone_skill_repo(url, target_dir)`，内部用 `git2::Repository::clone(url, target_dir)`（或 `RepoBuilder` 做浅克隆、分支指定等）。
  - “从来源安装”流程：先调该命令把 repo 克隆到目标技能目录，再视需要执行后续步骤（若当前 `skills add` 在 clone 后仅做简单文件操作，可在 Rust 里完成，避免再调一次 Node）。
- **效果**：不再依赖本机 Git，无需打包 Git 二进制，安装包体积小于方案 B。

**参考**：[git2 - Rust](https://docs.rs/git2/latest/git2/)，[clone 示例](https://github.com/rust-lang/git2-rs/blob/master/examples/clone.rs)。

---

## 五、方案 B：同时内置 Node 与 Git 二进制（统一、实现简单）

**为何更统一、更简单**：构建时与 Node 一样，按 target 下载 Git 并解压到 `binaries/git-<target>/`；运行时在 spawn 任何子进程（npx、git、或未来其他 Agent 工具）前，统一将 **PATH** 设为 `bundled_node_bin:bundled_git_bin:原PATH`。这样现有逻辑完全不变——仍调用 `npx skills find/add/remove`，`skills add` 内部的 `git clone` 自然用到内置 Git。无需在 Rust 里集成 git2、无需复刻或适配 `skills add` 的 clone 后行为，所有依赖 Git 的 Agent 工具也一并可用。代价主要是体积多约 **30～40MB/平台**（Git 二进制）；若可接受，推荐本方案。

- **Node**：同方案 A 的 4.1（下载、解压到 `binaries/node-<target>/`，运行时优先用该 npx）。
- **Git**：
  - 各平台按 3.2 准备 Git 二进制，放入 `binaries/git-<target>/`，随 `bundle.resources` 打包。
  - 在调用 **任意** 需要 Node 或 Git 的 Tauri 命令时，统一设置环境变量：`PATH = resource_dir()/node-<target>/bin:resource_dir()/git-<target>/bin:env::PATH`（Windows 需含 `cmd` 等），再 spawn 子进程。
- **实现要点**：与 OpenCode 的 sidecar 模式一致，仅多「按 target 下载 Git」的构建脚本；运行时只做 PATH 前置，不新增 Rust 依赖。

---

## 六、方案 C：Node 侧边单可执行文件（pkg 等）

- 使用 [@yao-pkg/pkg](https://github.com/yao-pkg/pkg) 或类似工具，把“调用 skills 的 Node 脚本”打成**单个可执行文件**（内嵌 Node 运行时），作为 Tauri 的 sidecar（与现有 OpenCode sidecar 类似）。
- 应用内不再调用系统 `npx`，而是执行该 sidecar，传入子命令（如 `find` / `add` / `remove`）和参数。
- **难点**：
  - `skills` 及其依赖（含可能的 native 模块）需能完整打进 pkg；若有 `child_process.exec('git clone')`，仍需要本机 Git 或改为在 Rust 用 git2 做 clone。
  - 若希望“完全不依赖本机环境”，仍需配合方案 A 的 git2 或方案 B 的内置 Git。

---

## 七、Python 内置（可选）

若希望**不依赖本机 Python** 即可运行声明需要 Python 的 Skill，也可以把 Python 随应用一起打包。技术上可行，与 Node 内置思路一致。

### 7.1 各平台获取方式与体积

| 平台 | 来源 | 形式与体积（约） |
|------|------|------------------|
| **Windows** | [python.org 可嵌入包](https://www.python.org/downloads/windows/) | `python-3.x.x-embed-amd64.zip`，约 **7～15MB**（仅运行时）；可再用 `get-pip.py` 装 pip，供 Skill 自用。 |
| **macOS** | python.org 安装包或官方 build | 解压 `.pkg` 或使用 standalone build，约 **30～50MB**；需区分 x64/arm64。 |
| **Linux** | 官方源码编译或第三方静态 build | 约 **20～40MB**（minimal 或 static），需按 distro/arch 准备。 |

### 7.2 实现思路

- **构建**：在 `beforeBuildCommand` 或独立脚本中，按 `TAURI_ENV_TARGET_TRIPLE` 下载对应平台的 Python（Windows 用 embeddable zip，macOS/Linux 用官方/静态包），解压到例如 `src-tauri/binaries/python-<target>/`，通过 `bundle.resources` 打包（或打包成 zip 首次运行时解压到应用数据目录）。
- **运行时**：当 Skill 声明需要 Python 时，优先查找 `resource_dir()/python-<target>/bin/python`（或 Windows 下 `python.exe`）；找不到再回退到系统 `python3`/`python`。调用 Skill 脚本时使用该解释器路径。
- **pip / 依赖**：Windows embeddable 默认不含 pip，可用官方 `get-pip.py` 在首次使用或构建时装好；Skill 若需要第三方库，可约定在 Skill 目录下用内置 Python 建 venv 再装，或由应用在固定子目录维护一个 venv。若只跑简单脚本、无依赖，可不装 pip。

### 7.3 注意点

- **版本**：选一个 LTS 如 3.11 或 3.12 作为内置版本；与系统 Python 的差异需在文档中说明。
- **体积**：每平台增加约 **10～50MB**（视是否含 pip、stdlib 裁剪程度而定）。
- **可选性**：Python 内置与 Node/Git 内置相互独立，可按需求只做 Node、或 Node+Python，不做 Git（用 Rust git2）。

---

## 八、实施顺序建议

- **若选方案 B**（推荐：统一简单、体积增加可接受）：  
  1）构建脚本：先做 Node 下载/解压（如 `download-node.mjs`），再做 Git 下载/解压（如 `download-git.mjs`），与 OpenCode 同模式；2）运行时：在需要 npx/git 的 Tauri 命令里统一把内置 Node、Git 的 bin 前置到 PATH 再 spawn。无需 Rust git2、无需改“从来源安装”流程。  
- **若选方案 A**（优先控体积）：  
  1）先做 Rust git2 的 clone 命令并替换“从来源安装”中的 Git 调用；2）再做 Node 内置（同上）；3）不打包 Git。  
- **Python 内置**：与 Node/Git 方案独立，按需在构建中增加 Python 下载与运行时优先使用逻辑（见第七章）。

---

## 九、参考与延伸

- Tauri 侧边二进制与资源：[Embedding External Binaries](https://v2.tauri.app/develop/sidecar/)、[Sidecar Node.js](https://v2.tauri.app/learn/sidecar-nodejs/)。
- 本项目已有类似做法：OpenCode 在构建时通过 `scripts/download-opencode.mjs` 下载并放入 `src-tauri/binaries/`，可作为 Node 下载/解压脚本的参考。
- 用户环境说明：[user-environment.md](user-environment.md)。
- **引导用户安装（暂不内置时）**：skills.sh 上的 [environment-setup-guide](https://skills.sh/sickn33/antigravity-awesome-skills/environment-setup-guide) 提供 Node.js、Python、Git 分平台安装与验证指引，可推荐给用户或集成类似能力。

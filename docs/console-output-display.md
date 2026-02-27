# Console 输出正确显示 — 调研与方案

## 现状

- **后端**（`src-tauri/src/lib.rs`）：在流式读取 stdout/stderr 时对每段数据调用 `strip_ansi()`，把 ANSI 转义序列全部去掉后再通过 `cmd_output` 事件发给前端。
- **前端**（`ConsoleOutputView.tsx`）：用 `<pre>` 展示纯文本，并做了换行符统一、画框字符转 ASCII（`sanitizeBoxDrawing`）。

因此当前前端拿到的已是**无 ANSI** 的纯文本，无法显示颜色、加粗等。

---

## 目标

「正确显示 console 内容」通常指：

1. **保留并渲染 ANSI**：颜色、加粗、下划线等（npm、构建工具、测试框架等常用）。
2. **可选**：更接近真实终端（`\r` 覆盖、进度条、光标移动）— 若仅「只读输出」可暂不实现。

---

## 方案一：ANSI → HTML 渲染（推荐）

只读展示、带颜色的终端输出，用「ANSI 转 HTML」即可，无需完整终端模拟器。

### 库选型

| 库 | 特点 | 适用 |
|----|------|------|
| **fancy-ansi** | ~4KB gzip，React 组件 `AnsiHtml`，CSS 变量、Tailwind 插件，SGR 支持全，XSS 安全 | ✅ 首选，与现有 React + Tailwind 契合 |
| **ansi-to-react** | nteract 出品，`<Ansi>{text}</Ansi>`，下载量大，支持 `useClasses` | 备选 |
| **ansi-to-html** | 转 HTML 字符串，无 React 组件，需 `dangerouslySetInnerHTML` | 不优先 |

### fancy-ansi 用法摘要

```bash
pnpm add fancy-ansi
```

```tsx
import { AnsiHtml } from "fancy-ansi/react";

// 直接渲染带 ANSI 的字符串
<AnsiHtml
  className="font-mono whitespace-pre-wrap break-words text-[13px]"
  text={rawStdout}
/>
```

- 无 ANSI 时等价于纯文本，安全。
- 颜色/主题可通过 CSS 变量（如 `--ansi-red`、`--ansi-green`）或官方 Tailwind 插件统一适配亮/暗色。

### 后端改动要点

要「正确显示」颜色，后端必须**不再**在流式输出路径里 strip ANSI，而是把**原始 stdout/stderr 字符串**发给前端：

- 在 `lib.rs` 里，对 `cmd_output` 的 `data` 不再调用 `strip_ansi(...)`，直接发送 `String::from_utf8_lossy(...).to_string()`（或等价物）。
- 若存在「解析用」和「展示用」两路（例如搜索 skill 列表仍需纯文本），可只对「展示用」的流保留原始内容，解析用路径继续 strip。

这样前端拿到的仍为 UTF-8 文本，只是其中包含 ANSI 转义，由 fancy-ansi 在浏览器中安全渲染。

### 前端改动要点

- 在 `ConsoleOutputView` 中，对 `run.stdout` / `run.stderr` 使用 `<AnsiHtml text={…} />` 替代当前 `<pre>{stdout}</pre>`。
- 换行符统一、画框字符转 ASCII 可保留：在传给 `AnsiHtml` 之前对字符串做 `normalizeLines` + `sanitizeBoxDrawing`（或按需只做其一），再传 `text={...}`。
- 样式：保持现有容器（滚动、等宽字体、字号），把原先 `pre` 的 className 挪到 `AnsiHtml` 上即可；需要时在全局或父级配置 `--ansi-*` 以适配暗色。

---

## 方案二：完整终端模拟（xterm.js）

若需要**可交互终端**（输入、光标、完整控制序列如 `\r`、进度条覆盖等），再考虑 **xterm.js** 或 **@xterm/xterm** + React 封装（如 `xterm-for-react`、`@pablo-lion/xterm-react`）：

- 优点：行为最接近真实终端。
- 缺点：体积大、需 PTY 或按终端协议喂数据，实现复杂；当前仅「展示历史输出」的场景通常不需要。

建议先完成方案一，再按产品需求决定是否上 xterm。

---

## 小结

- **正确显示 console 内容**：优先用 **fancy-ansi** 在前端把 ANSI 转成带样式的 HTML；后端对应地**不要**对展示用流式输出做 `strip_ansi`，传原始内容。
- 若只读、仅需颜色与格式：方案一即可；若后续要做交互终端，再调研 xterm.js 集成。

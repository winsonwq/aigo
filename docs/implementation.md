# 实现最佳实践

本文档定义 AIGO 项目在实现层面的约定与最佳实践，供开发与 Agent 协作时遵循。

---

## 1. CSS 与样式

### 1.1 使用 CSS 变量

**原则**：所有会复用的颜色、尺寸、间距、字体、圆角、阴影、过渡时间等，必须在 `:root`（或主题层）中定义为 CSS 变量，在具体样式中**只引用变量**，不写魔法数字或硬编码色值。

- **便于维护**：改主题、做暗色模式时只需改变量。
- **风格统一**：全站尺寸与颜色一致。
- **可读性**：变量名即语义（如 `--color-text-primary`），比 `#0f0f0f` 更易理解。

### 1.2 变量命名与分类

建议在根样式文件（如 `src/App.css` 或 `src/index.css`）的 `:root` 中集中定义，并按以下分类命名：

| 类别 | 前缀 / 示例 | 说明 |
|------|-------------|------|
| **颜色** | `--color-*` | 文本、背景、边框、强调、链接、错误/成功等 |
| **尺寸 / 间距** | `--size-*`、`--space-*` | 宽高、内边距、外边距、图标/头像尺寸等 |
| **字体** | `--font-*` | 字体族、字号、行高、字重 |
| **圆角** | `--radius-*` | 按钮、卡片、输入框等圆角 |
| **阴影** | `--shadow-*` | box-shadow |
| **过渡** | `--duration-*`、`--ease-*` | 动画时长、缓动函数 |
| **z-index** | `--z-*` | 层级（侧栏、弹层、toast 等） |

**示例定义**：

```css
:root {
  /* 颜色 */
  --color-text-primary: #0f0f0f;
  --color-text-secondary: #646464;
  --color-bg: #f6f6f6;
  --color-bg-elevated: #ffffff;
  --color-border: #e0e0e0;
  --color-accent: #646cff;
  --color-accent-hover: #535bf2;
  --color-link: #646cff;
  --color-link-hover: #535bf2;

  /* 尺寸与间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --size-sidebar-width: 240px;
  --size-icon: 20px;
  --size-avatar: 32px;

  /* 字体 */
  --font-sans: Inter, Avenir, Helvetica, Arial, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --line-height-base: 1.5;
  --font-weight-normal: 400;
  --font-weight-medium: 500;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.1);

  /* 过渡 */
  --duration-fast: 0.15s;
  --duration-normal: 0.25s;
  --ease-default: ease;
}
```

**使用方式**：

```css
.card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-elevated);
  box-shadow: var(--shadow-md);
  color: var(--color-text-primary);
}

.button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background-color: var(--color-accent);
  transition: background-color var(--duration-normal) var(--ease-default);
}
```

### 1.3 暗色模式

通过覆盖 `:root` 或 `[data-theme="dark"]` 下的变量实现，避免在多个选择器里重复写色值：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f6f6f6;
    --color-bg: #2f2f2f;
    --color-bg-elevated: #1e1e1e;
    --color-border: #404040;
    --color-accent: #24c8db;
    --color-link-hover: #24c8db;
  }
}
```

### 1.4 与 Tailwind 的配合

- 若使用 Tailwind：可在 `tailwind.config` 的 `theme.extend` 中引用同一套 CSS 变量，或使用 Tailwind 的 theme 值；二者择一，保持「单一数据源」。
- 自定义组件或局部样式里，**优先用 CSS 变量**，以便与全局主题一致。

---

## 2. TypeScript

- **类型优先**：为函数参数、返回值、组件 props 和 state 提供明确类型；避免 `any`，必要时用 `unknown` 或泛型。
- **接口集中**：公共类型、API 响应类型放在 `src/types/` 或就近于模块的 `types.ts`，便于复用与维护。
- **严格模式**：保持 `tsconfig.json` 中 `strict: true`（或等价严格选项）。

---

## 3. React 与组件

- **组件职责**：单文件单组件为主；若子组件仅被父组件使用，可同文件或同目录下拆分。
- **命名**：组件与文件名 PascalCase；hooks 以 `use` 开头；工具函数、常量按项目现有风格（camelCase）。
- **状态与副作用**：优先函数组件 + hooks；副作用集中在 `useEffect`，避免在渲染路径中产生副作用。
- **可访问性**：交互元素具备合理语义与键盘可操作性；图标按钮需 `aria-label` 或可见文案。

---

## 4. 状态管理（Redux）

- **全局状态**：使用 **Redux**（@reduxjs/toolkit + react-redux）。Store 在 `src/store/index.ts`，slices 在 `src/store/slices/`。
- **Slice 与 Thunk**：业务状态按领域拆成 slice（如 opencode、sessions、messages、workspace、modelOptions、skills）；异步与副作用用 `createAsyncThunk` 实现，在 thunk 内通过 `getState()` 取 client 等依赖。
- **UI 消费**：组件通过 `useSelector` / `useDispatch` 读状态、派发 action；保留薄 Context 封装（如 `WorkspaceProvider`、`OpenCodeProvider`）对外提供与重构前一致的 API（如 `useWorkspace()`、`useOpenCode()`），内部从 store 读并 dispatch thunk。
- **非序列化**：`opencode.client` 为 SDK 实例，已在 store 的 `serializableCheck.ignoredPaths` 中忽略。

---

## 5. 文件与目录

- **路由与页面**：页面级组件放在 `src/pages/`，与路由一一对应。
- **组件**：通用 UI 放在 `src/components/`；仅单页使用的可放在该页同目录或 `components` 子目录。
- **hooks / 工具**：共享 hooks 放在 `src/hooks/`，工具函数放在 `src/utils/`（或按模块划分子目录）。
- **样式**：全局变量与基础样式放在 `App.css` 或 `index.css`；组件级样式可用 CSS Modules 或与组件同名的 `.module.css`，并**使用全局 CSS 变量**。

---

## 6. 与本文档的同步

- 新加通用颜色、间距、字号等时，先补全 `:root` 中的变量，再在样式中引用。
- 重构旧样式时，逐步把硬编码色值、尺寸替换为变量，并视情况补充暗色模式变量。
- 本文档随项目演进更新；若约定与 AGENTS.md 或 PLAN.md 冲突，以 AGENTS.md 与 PLAN 为准，并同步修正本文档。

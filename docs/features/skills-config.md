# Skills 配置

## 概述

Skills 配置功能基于 **Anthropic Agent Skills 标准**（[agentskills.io](https://agentskills.io)），允许用户通过文档化的技能包来扩展 Agent 的能力。Skills 不是工具函数，而是包含指令、脚本和资源的模块化包，Agent 可以根据需要动态加载这些技能来指导其行为。

## Anthropic Agent Skills 标准

### 技能结构

每个 Skill 是一个目录，包含以下结构：

```
skill-name/
├── SKILL.md          # 必需：技能定义文件
├── scripts/          # 可选：可执行代码
├── references/       # 可选：额外文档
└── assets/           # 可选：静态资源（模板、图片、数据文件）
```

### SKILL.md 格式

`SKILL.md` 文件包含 YAML frontmatter 和 Markdown 内容：

**必需字段（Frontmatter）：**
```yaml
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

**可选字段：**
- `license`: 技能许可证
- `compatibility`: 环境要求（产品、系统包、网络访问等）
- `metadata`: 键值对形式的额外元数据
- `allowed-tools`: 技能可使用的预批准工具列表（实验性）

**Body 内容：**
Markdown 格式的技能指令，建议包含：
- 分步指令
- 输入输出示例
- 常见边界情况

### 渐进式披露（Progressive Disclosure）

Skills 采用渐进式披露机制，优化上下文使用：

1. **元数据阶段（~100 tokens）**：启动时加载所有技能的 `name` 和 `description`
2. **指令阶段（< 5000 tokens 推荐）**：激活技能时加载完整的 `SKILL.md` body
3. **资源阶段（按需）**：仅在需要时加载 `scripts/`、`references/` 或 `assets/` 中的文件

这种机制确保 Agent 保持高效，同时在需要时能够访问详细信息。

## 功能特性

- **Skills 目录管理**：支持添加、编辑、删除技能目录
- **渐进式加载**：按需加载技能内容，优化性能
- **技能激活**：Agent 根据上下文自动激活相关技能
- **技能组合**：多个技能可以组合使用
- **本地/远程技能**：支持本地目录和远程 URL

## 实现要点

- **技能存储**：管理技能目录路径或 URL
- **技能加载器**：实现渐进式披露加载机制
- **技能解析**：解析 SKILL.md 的 YAML frontmatter 和 Markdown 内容
- **Agent 集成**：在 Agent 提示词中注入激活的技能指令
- **资源管理**：按需加载 scripts、references、assets

## 与 MCP 工具的区别

- **MCP 工具**：可执行的函数，Agent 直接调用执行
- **Skills**：文档化指令，指导 Agent 如何执行任务，可能使用 MCP 工具

Skills 和 MCP 工具是互补的：
- Skills 提供"做什么"和"怎么做"的指导
- MCP 工具提供"执行能力"

## 参考资源

- [Anthropic Agent Skills 规范](https://agentskills.io/specification)
- [Anthropic 官方公告](https://www.anthropic.com/news/skills)

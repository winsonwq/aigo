# Agent 指南

## 项目概述

ready2work：项目脚手架与协作基线，包含文档结构、提交规范与 Agent 说明。

## 技术栈与结构

- 技术：待按实际项目补充（如 Node / Python / 等）
- 主要目录：`docs/` 文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [PLAN.md](PLAN.md) | 项目规划（目标、阶段、任务） |
| [docs/git-commit.md](docs/git-commit.md) | Git 提交规范 (Conventional Commits) |
| [docs/openwork-reference.md](docs/openwork-reference.md) | 从 OpenWork 可参考的基础功能与 OpenCode Client 使用方式 |

## 开发约定

- 语言/格式化：按后续引入的技术栈配置
- 测试：按项目需要补充

## 常用命令

```bash
# 安装、测试、运行等（按项目类型补充）
```

## 与 Agent 协作

- 提交信息遵循 [docs/git-commit.md](docs/git-commit.md) 中的 Conventional Commits 规范
- 项目说明与约定以本文件与 `docs/` 为准

## 功能完成与 AI 自测

- **每完成一个功能（或一个 PLAN.md 中的任务块）**：必须先设计该功能的 **AI 自测方案**（例如：要验证的行为、操作步骤、预期结果、可自动检查的断言或手工检查清单）。
- **完成实现后**：按照自测方案执行 **自我测试**（可由 AI 驱动浏览器/自动化或按清单逐步验证），直到 **所有自测通过、行为符合预期** 再视为该功能完成。
- 若自测失败：先修复实现或修正自测标准，再重新跑自测，不把未通过自测的功能标记为完成。

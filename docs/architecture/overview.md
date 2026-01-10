# 架构概述

## 项目定位

本项目是一个类似 **Gemini Chat / ChatGPT** 的 AI 聊天工具，核心特点是**所有对话都支持 ReAct Agent 模式**，可以自动调用 MCP 工具和自定义 Skills。参考了 Manus 的设计思路。

提供对话、Session 管理、MCP/Skills/模型配置等功能。

## 核心架构

### 前端层

- Next.js + React
- DaisyUI 组件库
- React 图标库

### Agent 层

- LangGraph 实现 ReAct 循环
- @langchain/mcp-adapters 桥接 MCP 工具
- 多模型支持

### 数据层

- Session 数据管理
- 记忆管理（Session 级别）
- 配置管理

## 待补充

（待详细定义）

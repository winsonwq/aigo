# MCP 配置

## 概述

MCP (Model Context Protocol) 配置功能允许用户配置和管理 MCP Server，将 MCP Server 的工具转换为 LangChain 可用的工具。

## 功能特性

- MCP Server 配置管理
- 工具自动发现和注册
- 使用 @langchain/mcp-adapters 进行桥接
- 支持多个 MCP Server 同时运行

## 实现要点

- 使用 @langchain/mcp-adapters 将 MCP Server 工具转换为 DynamicTool
- 工具动态加载和卸载
- 工具权限和访问控制

## 待补充

（待详细定义）

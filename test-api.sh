#!/bin/bash

# Agent API 测试脚本

echo "=== 测试 1: 基础对话 ==="
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好，请介绍一下你自己"}' \
  | jq '.'

echo -e "\n=== 测试 2: 工具调用（计算） ==="
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "请帮我计算 25 乘以 17 等于多少"}' \
  | jq '.'

echo -e "\n=== 测试 3: 错误处理（缺少 message） ==="
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{}' \
  | jq '.'

echo -e "\n测试完成！"

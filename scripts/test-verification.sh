#!/bin/bash

# 自动化测试验证脚本
# 用于验证 Phase 2 的基本功能

set -e

echo "=== Phase 2: Agent 引擎验证测试 ==="
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试 1: 构建测试
echo "1. 构建测试..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 构建成功${NC}"
else
  echo -e "${RED}✗ 构建失败${NC}"
  exit 1
fi

# 测试 2: 计算器工具测试
echo ""
echo "2. 计算器工具测试..."
if npx tsx -e "
import { calculatorTool } from './lib/tools/test-tool';
(async () => {
  const r1 = await calculatorTool.invoke({ operation: 'add', a: 10, b: 20 });
  if (r1 !== '10 + 20 = 30') throw new Error('加法测试失败');
  const r2 = await calculatorTool.invoke({ operation: 'multiply', a: 5, b: 6 });
  if (r2 !== '5 × 6 = 30') throw new Error('乘法测试失败');
  console.log('✓ 所有工具测试通过');
})();
" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 工具测试通过${NC}"
else
  echo -e "${RED}✗ 工具测试失败${NC}"
  exit 1
fi

# 测试 3: 工具注册表测试
echo ""
echo "3. 工具注册表测试..."
if npx tsx -e "
import { toolRegistry } from './lib/tools/registry';
import { calculatorTool } from './lib/tools/test-tool';
toolRegistry.register(calculatorTool);
const tool = toolRegistry.getTool('calculator');
if (!tool) throw new Error('工具获取失败');
const count = toolRegistry.getAllTools().length;
if (count !== 1) throw new Error('工具数量不正确');
console.log('✓ 注册表测试通过');
" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 注册表测试通过${NC}"
else
  echo -e "${RED}✗ 注册表测试失败${NC}"
  exit 1
fi

# 测试 4: Agent Graph 创建测试
echo ""
echo "4. Agent Graph 创建测试..."
if npx tsx -e "
import { createAgent } from './lib/agent/graph';
const agent = createAgent(10);
if (!agent) throw new Error('Agent 创建失败');
console.log('✓ Agent 创建成功');
" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Agent 创建测试通过${NC}"
else
  echo -e "${RED}✗ Agent 创建测试失败${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== 所有基础测试通过 ===${NC}"
echo ""
echo -e "${YELLOW}注意：完整的功能测试需要 OpenAI API Key${NC}"
echo "请运行以下命令进行完整测试："
echo "  export OPENAI_API_KEY=your-key"
echo "  npm run dev"
echo "  # 然后使用 curl 或 Postman 测试 /api/chat 端点"

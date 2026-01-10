# 测试指南

## Phase 2: Agent 引擎测试

### 前置条件

1. **环境变量设置**

   **使用 OpenRouter（推荐）**:
   ```bash
   export OPENROUTER_API_KEY="your-openrouter-api-key"
   export OPENROUTER_MODEL="openai/gpt-4o-mini"  # 可选，默认值
   export OPENROUTER_REFERER="https://github.com/aigo"  # 可选
   export OPENROUTER_TITLE="AIGO"  # 可选
   ```

   或者在 `.env.local` 文件中设置：
   ```
   OPENROUTER_API_KEY=your-openrouter-api-key
   OPENROUTER_MODEL=openai/gpt-4o-mini
   ```

   **使用 OpenAI（备选）**:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export OPENAI_MODEL="gpt-4o-mini"  # 可选，默认值
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

### 测试步骤

#### 1. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

#### 2. 测试基础对话（非流式）

使用 curl 测试 API：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好，请介绍一下你自己"
  }'
```

**预期结果**：
- 返回 JSON 响应
- 包含 `content` 字段，包含 AI 的回复
- 包含 `messages` 数组，包含完整的对话历史

#### 3. 测试工具调用

测试 Agent 是否能正确调用工具（计算器）：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "请帮我计算 25 乘以 17 等于多少"
  }'
```

**预期结果**：
- AI 应该识别需要计算
- 调用 `calculator` 工具
- 返回计算结果：`25 × 17 = 425`

#### 4. 测试流式输出

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "计算 100 除以 4",
    "stream": true
  }'
```

**预期结果**：
- 返回 Server-Sent Events (SSE) 流
- 实时输出事件数据
- 最后发送 `[DONE]` 标记

#### 5. 测试错误处理

测试缺少 API Key 的情况：

```bash
# 临时移除 API Key
unset OPENAI_API_KEY

# 重启服务器后测试
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "测试"
  }'
```

**预期结果**：
- 返回错误响应（500 状态码）
- 错误信息包含 "OPENAI_API_KEY"

### 测试检查清单

- [ ] 基础对话功能正常
- [ ] AI 能够正确理解和回复
- [ ] 工具调用功能正常（计算器工具）
- [ ] ReAct 循环正常工作（思考 -> 工具调用 -> 观察 -> 回复）
- [ ] 流式输出功能正常
- [ ] 错误处理正常（缺少 API Key、无效请求等）
- [ ] 代码构建成功，无类型错误

### 使用 Postman 或类似工具测试

1. **创建新请求**
   - Method: `POST`
   - URL: `http://localhost:3000/api/chat`
   - Headers: `Content-Type: application/json`

2. **请求 Body（JSON）**
   ```json
   {
     "message": "计算 10 + 20",
     "stream": false
   }
   ```

3. **查看响应**
   - 检查状态码（应该是 200）
   - 检查响应体中的 `content` 字段
   - 检查 `messages` 数组

### 浏览器测试（如果前端已实现）

1. 访问 `http://localhost:3000/agents`
2. 在输入框中输入消息
3. 点击发送
4. 查看 AI 回复

### 常见问题

1. **API Key 错误**
   - 确保 `OPENAI_API_KEY` 环境变量已设置
   - 确保 API Key 有效且有足够的额度

2. **端口被占用**
   - 修改 `package.json` 中的 dev 脚本：`"dev": "next dev -p 3001"`

3. **构建错误**
   - 运行 `npm run build` 查看详细错误信息
   - 确保所有依赖已正确安装

### 测试记录

测试完成后，请在 `AGENTS.md` 的"最近更新"部分记录测试结果。

---

*测试是开发流程中不可或缺的一部分，确保功能正常工作后再继续下一个阶段。*

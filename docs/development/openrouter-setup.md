# OpenRouter 集成说明

## 概述

项目已集成 OpenRouter API，这是一个统一的 API 接口，可以访问多个模型提供商（OpenAI、Anthropic、Google 等）。

## 配置

### 环境变量

在 `.env.local` 文件中设置（推荐，Next.js 会自动加载）：

```env
OPENROUTER_API_KEY=sk-or-v1-your-api-key
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_REFERER=https://github.com/aigo
OPENROUTER_TITLE=AIGO
```

**注意**: Next.js 会自动加载 `.env.local` 文件，无需额外配置。

### 环境变量说明

- `OPENROUTER_API_KEY`: OpenRouter API Key（必需）
- `OPENROUTER_MODEL`: 模型名称（可选，默认：`openai/gpt-4o-mini`）
  - 格式：`provider/model-name`
  - 示例：`openai/gpt-4o-mini`, `anthropic/claude-3-haiku`, `google/gemini-pro`
- `OPENROUTER_REFERER`: HTTP Referer header（可选）
- `OPENROUTER_TITLE`: X-Title header（可选）

## 支持的模型

OpenRouter 支持多种模型，常见的有：

- `openai/gpt-4o-mini` - OpenAI GPT-4o Mini
- `openai/gpt-4o` - OpenAI GPT-4o
- `anthropic/claude-3-haiku` - Anthropic Claude 3 Haiku
- `anthropic/claude-3-sonnet` - Anthropic Claude 3 Sonnet
- `google/gemini-pro` - Google Gemini Pro

查看完整模型列表：https://openrouter.ai/models

## 优先级

系统会按以下优先级选择 API：

1. **OpenRouter**（如果设置了 `OPENROUTER_API_KEY`）
2. **OpenAI**（如果设置了 `OPENAI_API_KEY`）

## 使用

配置完成后，重启开发服务器：

```bash
npm run dev
```

然后就可以正常使用 Chat API 了。

## 测试

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}'
```

## 当前配置

项目已配置的 API Key（在 `.env.local` 中）：
- API Key: `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`
- 模型: `google/gemini-3-flash-preview`

## 参考

- OpenRouter 文档: https://openrouter.ai/docs
- 模型列表: https://openrouter.ai/models

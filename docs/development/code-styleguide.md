# 代码风格指南

本文档定义了项目的代码风格和最佳实践，所有代码都应遵循这些规范。

## 目录

- [TypeScript 规范](#typescript-规范)
- [错误处理](#错误处理)
- [函数设计](#函数设计)
- [代码可读性](#代码可读性)
- [命名规范](#命名规范)
- [文件组织](#文件组织)
- [注释和文档](#注释和文档)
- [导入和导出](#导入和导出)
- [类型定义](#类型定义)
- [测试规范](#测试规范)

---

## TypeScript 规范

### 类型安全

**重要原则：不轻易使用 `any` 和 lint disable，保持类型严谨性**

- ✅ **必须使用明确的类型**：避免使用 `any`，优先使用具体类型或 `unknown`
- ✅ **使用类型推断**：在类型明确的情况下，让 TypeScript 自动推断
- ✅ **使用泛型**：提高代码复用性和类型安全
- ❌ **禁止使用 `any`**：除非有充分理由，否则必须使用具体类型
- ❌ **禁止使用 `@ts-ignore` 或 `@ts-expect-error`**：遇到类型错误应修复，而不是忽略

**示例：**

```typescript
// ❌ 错误：使用 any
function processData(data: any) {
  return data.value;
}

// ✅ 正确：使用具体类型或泛型
function processData<T extends { value: unknown }>(data: T): T["value"] {
  return data.value;
}

// ✅ 正确：使用 unknown 进行类型守卫
function processData(data: unknown) {
  if (typeof data === "object" && data !== null && "value" in data) {
    return (data as { value: unknown }).value;
  }
  throw new Error("Invalid data");
}
```

### 类型定义

- ✅ **优先使用 `interface`**：用于对象类型定义
- ✅ **使用 `type`**：用于联合类型、交叉类型、工具类型
- ✅ **使用 `enum`**：用于常量集合（谨慎使用，优先使用 const 对象）
- ✅ **导出类型**：公共类型必须导出，私有类型使用 `_` 前缀

**示例：**

```typescript
// ✅ 接口定义
export interface UserConfig {
  name: string;
  age: number;
}

// ✅ 类型别名
export type UserRole = "admin" | "user" | "guest";

// ✅ 工具类型
export type PartialUser = Partial<UserConfig>;
```

---

## 错误处理

### 统一错误处理机制

**不要总是使用 try-catch，使用 Result 模式进行错误处理**

项目使用统一的错误处理机制（`lib/utils/errors.ts`），基于 Result 模式：

- ✅ **使用 Result 类型**：`Result<T, E>` 表示可能失败的操作
- ✅ **使用 `tryCatch` 包装**：将可能抛出异常的函数包装为 Result
- ✅ **使用 `match` 处理**：统一处理成功和失败情况
- ❌ **避免频繁使用 try-catch**：仅在边界层（如 API Route）使用
- ❌ **避免直接抛出错误**：业务逻辑中应返回 Result

**示例：**

```typescript
// ❌ 错误：频繁使用 try-catch
async function fetchUser(id: string) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// ✅ 正确：使用 Result 模式
import { tryCatch, Result, ok, err } from "@/lib/utils/errors";

async function fetchUser(id: string): Promise<Result<User, AppError>> {
  return tryCatch(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return err(createError("Failed to fetch user", "FETCH_ERROR", response.status));
    }
    const user = await response.json();
    return ok(user);
  });
}

// ✅ 使用 match 处理结果
const result = await fetchUser("123");
match(
  result,
  (user) => console.log("User:", user),
  (error) => console.error("Error:", error.message)
);
```

### 错误类型

- ✅ **使用 `AppError`**：自定义错误类型，包含 code、statusCode、details
- ✅ **错误代码规范**：使用大写字母和下划线，如 `FETCH_ERROR`、`VALIDATION_ERROR`
- ✅ **错误信息清晰**：错误消息应清晰描述问题，便于调试

**示例：**

```typescript
import { createError, AppError } from "@/lib/utils/errors";

// ✅ 创建应用错误
const error = createError(
  "User not found",
  "USER_NOT_FOUND",
  404,
  { userId: "123" }
);

// ✅ 在 API Route 中使用
export async function GET(request: NextRequest) {
  const result = await fetchUser("123");
  
  if (!result.success) {
    const error = result.error;
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: error.statusCode || 500 }
    );
  }
  
  return Response.json(result.value);
}
```

### 边界层错误处理

在 API Route、中间件等边界层，使用统一的错误处理机制：

#### API 路由错误处理

项目提供了统一的 API 错误处理机制（`lib/api-handler.ts` 和 `lib/api-error.ts`），参考 `agents-2d` 项目的实现：

- ✅ **使用 `tryCatch` 包装器**：自动捕获错误并返回统一的错误响应
- ✅ **使用 `ApiError` 类**：创建带状态码和错误代码的错误
- ✅ **统一的错误响应格式**：包含 `error`、`code`、`details` 字段

**示例：**

```typescript
// ✅ 正确：使用 tryCatch 和 ApiError
import { tryCatch } from "@/lib/api-handler";
import { ApiError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";

export const POST = tryCatch(async function (request: NextRequest) {
  const body = await request.json();
  
  if (!body.message) {
    throw ApiError.badRequest("Message is required", "MISSING_MESSAGE");
  }
  
  // 业务逻辑...
  return NextResponse.json({ success: true });
});

// ApiError 会自动转换为适当的 HTTP 响应：
// {
//   "error": "Message is required",
//   "code": "MISSING_MESSAGE",
//   "details": { "stack": "..." }  // 仅开发环境
// }
```

**ApiError 静态方法：**

```typescript
ApiError.badRequest(message, code?, details?)      // 400
ApiError.unauthorized(message?, code?, details?)    // 401
ApiError.forbidden(message?, code?, details?)       // 403
ApiError.notFound(message?, code?, details?)       // 404
ApiError.conflict(message, code?, details?)         // 409
ApiError.unprocessableEntity(message, code?, details?) // 422
ApiError.internal(message?, code?, details?)        // 500
```

**流式响应错误处理：**

流式响应（Server-Sent Events）需要在 `ReadableStream` 的回调中处理错误：

```typescript
async function streamResponse(...): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 流式处理逻辑
      } catch (error) {
        // 通过 SSE 发送错误给客户端
        const errorMessage = error instanceof Error ? error.message : String(error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
        );
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
```

---

## 函数设计

### 函数长度限制

**函数不应超过 100 行，超过时应拆分为多个小函数**

- ✅ **单一职责**：每个函数只做一件事
- ✅ **函数长度**：不超过 100 行（包括空行和注释）
- ✅ **参数数量**：不超过 5 个参数，超过时使用对象参数
- ✅ **返回值明确**：函数应返回明确类型，避免返回 `any`

**示例：**

```typescript
// ❌ 错误：函数过长（超过 100 行）
async function processUserData(userData: unknown) {
  // ... 200 行代码 ...
}

// ✅ 正确：拆分为多个小函数
async function processUserData(userData: unknown): Promise<Result<User, AppError>> {
  const validationResult = validateUserData(userData);
  if (!validationResult.success) {
    return err(validationResult.error);
  }

  const normalizedData = normalizeUserData(validationResult.value);
  const saveResult = await saveUser(normalizedData);
  
  return saveResult;
}

function validateUserData(data: unknown): Result<RawUserData, AppError> {
  // 验证逻辑（< 50 行）
}

function normalizeUserData(data: RawUserData): User {
  // 规范化逻辑（< 30 行）
}

async function saveUser(user: User): Promise<Result<User, AppError>> {
  // 保存逻辑（< 50 行）
}
```

### 函数命名

- ✅ **动词开头**：函数名应使用动词，如 `getUser`、`createPost`、`validateInput`
- ✅ **描述性命名**：函数名应清晰描述功能
- ✅ **避免缩写**：除非是通用缩写（如 `id`、`url`），否则使用完整单词

**示例：**

```typescript
// ✅ 正确
function getUserById(id: string): Promise<Result<User, AppError>> { }
function calculateTotalPrice(items: Item[]): number { }
function validateEmailAddress(email: string): boolean { }

// ❌ 错误
function getUsr(id: string) { }  // 缩写
function calc(items: Item[]) { }  // 缩写
function val(email: string) { }  // 缩写
```

---

## 代码可读性

### 代码组织

- ✅ **逻辑分组**：相关代码应分组，使用空行分隔
- ✅ **早期返回**：使用早期返回减少嵌套
- ✅ **避免深层嵌套**：嵌套层级不超过 3 层
- ✅ **使用常量**：魔法数字和字符串应定义为常量

**示例：**

```typescript
// ❌ 错误：深层嵌套
function processOrder(order: Order) {
  if (order) {
    if (order.items) {
      if (order.items.length > 0) {
        if (order.status === "pending") {
          // 处理逻辑
        }
      }
    }
  }
}

// ✅ 正确：早期返回
function processOrder(order: Order): Result<void, AppError> {
  if (!order) {
    return err(createError("Order is required", "INVALID_ORDER"));
  }
  
  if (!order.items || order.items.length === 0) {
    return err(createError("Order must have items", "EMPTY_ORDER"));
  }
  
  if (order.status !== "pending") {
    return err(createError("Order must be pending", "INVALID_STATUS"));
  }
  
  // 处理逻辑
  return ok(undefined);
}
```

### 变量命名

- ✅ **使用有意义的变量名**：避免单字母变量（循环变量除外）
- ✅ **使用常量命名**：常量使用 `UPPER_SNAKE_CASE`
- ✅ **使用类型推断**：在类型明确时，让 TypeScript 推断类型

**示例：**

```typescript
// ✅ 正确
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

function fetchUserData(userId: string) {
  const userData = await fetchUser(userId);
  const processedData = processUserData(userData);
  return processedData;
}

// ❌ 错误
const max = 3;  // 不清晰
const url = "https://api.example.com";  // 不清晰
const d = await fetchUser(id);  // 单字母变量
```

### 代码注释

- ✅ **解释为什么**：注释应解释为什么这样做，而不是做什么
- ✅ **避免冗余注释**：代码本身已清晰的，不需要注释
- ✅ **使用 JSDoc**：公共函数应使用 JSDoc 注释

**示例：**

```typescript
// ❌ 错误：冗余注释
// 获取用户
function getUser(id: string) {
  // 返回用户
  return user;
}

// ✅ 正确：有意义的注释
/**
 * 获取用户信息
 * @param id - 用户 ID
 * @returns 用户信息，如果不存在则返回错误
 */
function getUser(id: string): Promise<Result<User, AppError>> {
  // 使用缓存避免重复查询数据库
  const cachedUser = cache.get(id);
  if (cachedUser) {
    return ok(cachedUser);
  }
  
  return fetchUserFromDatabase(id);
}
```

---

## 命名规范

### 文件命名

- ✅ **使用 kebab-case**：文件名使用小写字母和连字符，如 `user-service.ts`、`chat-container.tsx`
- ✅ **组件文件**：React 组件使用 PascalCase，如 `ChatContainer.tsx`、`UserProfile.tsx`
- ✅ **类型文件**：类型定义文件使用 `types.ts` 或 `*.types.ts`

**示例：**

```
lib/
  utils/
    errors.ts
    validation.ts
  services/
    user-service.ts
    chat-service.ts
components/
  chat/
    ChatContainer.tsx
    MessageList.tsx
  user/
    UserProfile.tsx
types/
  index.ts
  user.types.ts
```

### 变量和函数命名

- ✅ **变量和函数**：使用 `camelCase`，如 `userName`、`getUserById`
- ✅ **常量**：使用 `UPPER_SNAKE_CASE`，如 `MAX_RETRY_ATTEMPTS`、`API_BASE_URL`
- ✅ **类型和接口**：使用 `PascalCase`，如 `User`、`ChatMessage`、`AppError`
- ✅ **私有成员**：使用 `_` 前缀，如 `_privateMethod`、`_internalState`

**示例：**

```typescript
// 变量和函数
const userName = "John";
function getUserById(id: string) { }

// 常量
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

// 类型和接口
interface User {
  id: string;
  name: string;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// 私有成员
class UserService {
  private _cache: Map<string, User> = new Map();
  
  private _validateUser(user: User): boolean {
    // 私有方法
  }
}
```

---

## 文件组织

### 目录结构

- ✅ **按功能组织**：相关文件应放在同一目录
- ✅ **分离关注点**：类型、工具函数、业务逻辑应分开
- ✅ **避免深层嵌套**：目录层级不超过 4 层

**推荐结构：**

```
lib/
  agent/
    graph.ts          # Agent 图定义
    types.ts          # Agent 类型
    __tests__/        # 测试文件
  tools/
    registry.ts       # 工具注册表
    test-tool.ts      # 测试工具
    types.ts          # 工具类型
  utils/
    errors.ts         # 错误处理工具
    validation.ts     # 验证工具
components/
  chat/
    ChatContainer.tsx
    MessageList.tsx
    types.ts
```

### 导入顺序

- ✅ **分组导入**：按以下顺序组织导入
  1. 外部库（React、Next.js 等）
  2. 内部库（@/lib、@/components 等）
  3. 类型导入（使用 `import type`）
  4. 相对路径导入

**示例：**

```typescript
// 1. 外部库
import { NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";

// 2. 内部库
import { createAgent } from "@/lib/agent/graph";
import { toolRegistry } from "@/lib/tools/registry";

// 3. 类型导入
import type { User } from "@/types";
import type { MessagesAnnotation } from "@langchain/langgraph";

// 4. 相对路径导入
import { localHelper } from "./helpers";
```

---

## 注释和文档

### JSDoc 注释

- ✅ **公共函数**：所有导出的函数应使用 JSDoc 注释
- ✅ **复杂逻辑**：复杂算法和业务逻辑应添加注释
- ✅ **参数和返回值**：使用 `@param` 和 `@returns` 标注

**示例：**

```typescript
/**
 * 创建 ReAct Agent 图
 * 
 * @param maxIterations - 最大迭代次数，默认 10
 * @returns 编译后的 Agent 图实例
 * 
 * @example
 * ```typescript
 * const agent = createReActGraph(10);
 * const result = await agent.invoke({ messages: [new HumanMessage("Hello")] });
 * ```
 */
export function createReActGraph(maxIterations: number = 10) {
  // 实现
}
```

### README 和文档

- ✅ **README 文件**：每个模块应有 README 说明用途和使用方法
- ✅ **代码示例**：文档中应包含代码示例
- ✅ **更新文档**：代码变更时同步更新文档

---

## 类型定义

### 类型导出

- ✅ **公共类型**：所有公共类型必须导出
- ✅ **类型文件**：类型定义应放在 `types.ts` 或独立的类型文件
- ✅ **避免重复定义**：相同类型不应在多个文件中重复定义

**示例：**

```typescript
// types/user.types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export type UserRole = "admin" | "user" | "guest";

// 在其他文件中使用
import type { User, UserRole } from "@/types/user.types";
```

### 类型守卫

- ✅ **使用类型守卫**：使用 `typeof`、`instanceof`、自定义类型守卫
- ✅ **避免类型断言**：优先使用类型守卫，避免使用 `as`

**示例：**

```typescript
// ✅ 正确：使用类型守卫
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

function processUser(data: unknown) {
  if (isUser(data)) {
    // TypeScript 知道 data 是 User 类型
    console.log(data.name);
  }
}

// ❌ 错误：使用类型断言
function processUser(data: unknown) {
  const user = data as User;  // 不安全
  console.log(user.name);
}
```

---

## 测试规范

### 测试文件组织

- ✅ **测试文件位置**：测试文件放在 `__tests__` 目录或与源文件同目录的 `*.test.ts` 文件
- ✅ **测试命名**：测试文件使用 `*.test.ts` 或 `*.spec.ts`
- ✅ **测试描述**：使用清晰的测试描述

**示例：**

```
lib/
  agent/
    graph.ts
    __tests__/
      graph.test.ts
  tools/
    registry.ts
    registry.test.ts
```

### 测试编写

- ✅ **测试覆盖**：核心功能应有测试覆盖
- ✅ **测试独立性**：每个测试应独立，不依赖其他测试
- ✅ **使用描述性测试名**：测试名应清晰描述测试内容

**示例：**

```typescript
import { describe, it, expect } from "@jest/globals";
import { createReActGraph } from "../graph";

describe("createReActGraph", () => {
  it("should create a graph with default max iterations", () => {
    const graph = createReActGraph();
    expect(graph).toBeDefined();
  });

  it("should create a graph with custom max iterations", () => {
    const graph = createReActGraph(20);
    expect(graph).toBeDefined();
  });
});
```

---

## 总结

遵循以上代码风格指南可以：

- ✅ **提高代码质量**：类型安全、错误处理统一
- ✅ **提高可读性**：清晰的命名、合理的组织
- ✅ **提高可维护性**：小函数、单一职责
- ✅ **提高团队协作**：统一的风格，减少争议

**重要提醒**：

1. **不要使用 `any`**：遇到类型问题应修复，而不是使用 `any`
2. **不要使用 lint disable**：遇到 lint 错误应修复，而不是禁用
3. **函数不超过 100 行**：超过时应拆分为多个小函数
4. **使用 Result 模式处理错误**：避免频繁使用 try-catch
5. **保持代码可读性**：命名清晰、逻辑清晰、注释有意义

---

*本文档将随着项目发展持续更新和完善。*

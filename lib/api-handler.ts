/**
 * 统一的 API 路由错误处理包装器
 * 自动捕获错误并返回统一的错误响应
 * 参考 agents-2d 项目的实现
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api-error";

type RouteHandler<TParams = Record<string, string>> = (
  request: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<NextResponse | Response>;

/**
 * 统一的错误处理包装器
 * 自动捕获错误并返回统一的错误响应
 * 
 * @example
 * ```typescript
 * export const POST = tryCatch(async function (request: NextRequest) {
 *   const body = await request.json();
 *   if (!body.message) {
 *     throw ApiError.badRequest("Message is required");
 *   }
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function tryCatch<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>
): RouteHandler<TParams> {
  return async (request: NextRequest, context: { params: Promise<TParams> }) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("[API Error]:", error);

      // 如果是 ApiError，使用指定的状态码和详细信息
      if (error instanceof ApiError) {
        const responseBody: {
          error: string;
          code?: string;
          details?: unknown;
        } = {
          error: error.message,
        };

        if (error.code) {
          responseBody.code = error.code;
        }

        if (error.details) {
          responseBody.details = error.details;
        }

        // 开发环境下添加堆栈信息
        if (process.env.NODE_ENV === "development" && error.stack) {
          responseBody.details = {
            ...(typeof responseBody.details === "object" && responseBody.details !== null
              ? responseBody.details
              : {}),
            stack: error.stack,
          };
        }

        return NextResponse.json(responseBody, { status: error.statusCode });
      }

      // 其他错误（throw new Error 或 throw 'string'）默认返回 500
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Internal server error";

      const responseBody: {
        error: string;
        details?: unknown;
      } = {
        error: errorMessage,
      };

      // 开发环境下添加堆栈信息
      if (process.env.NODE_ENV === "development" && error instanceof Error && error.stack) {
        responseBody.details = {
          stack: error.stack,
        };
      }

      return NextResponse.json(responseBody, { status: 500 });
    }
  };
}

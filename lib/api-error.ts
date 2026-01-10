/**
 * API 错误类，用于在 route 和 service 中抛出带状态码的错误
 * 参考 agents-2d 项目的实现
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    // 保持正确的原型链
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * 创建 400 Bad Request 错误
   */
  static badRequest(message: string, code?: string, details?: unknown) {
    return new ApiError(message, 400, code, details);
  }

  /**
   * 创建 401 Unauthorized 错误
   */
  static unauthorized(message: string = "Unauthorized", code?: string, details?: unknown) {
    return new ApiError(message, 401, code, details);
  }

  /**
   * 创建 403 Forbidden 错误
   */
  static forbidden(message: string = "Forbidden", code?: string, details?: unknown) {
    return new ApiError(message, 403, code, details);
  }

  /**
   * 创建 404 Not Found 错误
   */
  static notFound(message: string = "Not found", code?: string, details?: unknown) {
    return new ApiError(message, 404, code, details);
  }

  /**
   * 创建 409 Conflict 错误
   */
  static conflict(message: string, code?: string, details?: unknown) {
    return new ApiError(message, 409, code, details);
  }

  /**
   * 创建 422 Unprocessable Entity 错误
   */
  static unprocessableEntity(message: string, code?: string, details?: unknown) {
    return new ApiError(message, 422, code, details);
  }

  /**
   * 创建 500 Internal Server Error 错误
   */
  static internal(message: string = "Internal server error", code?: string, details?: unknown) {
    return new ApiError(message, 500, code, details);
  }
}

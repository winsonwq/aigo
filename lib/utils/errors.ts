// 统一错误处理机制
// 避免在业务代码中频繁使用 try-catch，使用 Result 模式进行错误处理

/**
 * Result 类型：用于表示可能失败的操作
 * - Ok: 操作成功，包含结果值
 * - Err: 操作失败，包含错误信息
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * 成功结果
 */
export class Ok<T> {
  readonly success = true as const;
  constructor(public readonly value: T) {}

  /**
   * 映射成功值
   */
  map<U>(fn: (value: T) => U): Result<U, never> {
    return ok(fn(this.value));
  }

  /**
   * 扁平化嵌套的 Result
   */
  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * 如果失败则使用默认值
   */
  orElse<U>(_defaultValue: U): T | U {
    return this.value;
  }
}

/**
 * 失败结果
 */
export class Err<E> {
  readonly success = false as const;
  constructor(public readonly error: E) {}

  /**
   * 映射错误值
   */
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return err(this.error);
  }

  /**
   * 扁平化嵌套的 Result
   */
  flatMap<U, _F>(_fn: (value: never) => Result<U, _F>): Result<U, E> {
    return err(this.error);
  }

  /**
   * 如果失败则使用默认值
   */
  orElse<U>(defaultValue: U): U {
    return defaultValue;
  }
}

/**
 * 创建成功结果
 */
export function ok<T>(value: T): Ok<T> {
  return new Ok(value);
}

/**
 * 创建失败结果
 */
export function err<E>(error: E): Err<E> {
  return new Err(error);
}

/**
 * 将可能抛出异常的函数包装为 Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T | Promise<T>
): Promise<Result<T, E>> | Result<T, E> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(
        (value) => ok(value) as Result<T, E>,
        (error) => err(error as E)
      );
    }
    return ok(result) as Result<T, E>;
  } catch (error) {
    return err(error as E);
  }
}

/**
 * 从 Result 中提取值，如果失败则抛出错误
 * 仅在确定 Result 是 Ok 时使用
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.value;
  }
  const errResult = result as Err<E>;
  throw errResult.error;
}

/**
 * 从 Result 中提取值，如果失败则返回默认值
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.success ? result.value : defaultValue;
}

/**
 * 从 Result 中提取错误，如果成功则抛出错误
 * 仅在确定 Result 是 Err 时使用
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (!result.success) {
    const errResult = result as Err<E>;
    return errResult.error;
  }
  throw new Error("Cannot unwrap error from Ok result");
}

/**
 * 应用错误处理函数
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.success) {
    return ok(result.value);
  }
  const errResult = result as Err<E>;
  return err(fn(errResult.error));
}

/**
 * 应用成功处理函数
 */
export function mapOk<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.success) {
    return ok(fn(result.value));
  }
  const errResult = result as Err<E>;
  return err(errResult.error);
}

/**
 * 应用处理函数（成功和失败都处理）
 */
export function match<T, E, U>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => U
): U {
  if (result.success) {
    return onOk(result.value);
  }
  const errResult = result as Err<E>;
  return onErr(errResult.error);
}

/**
 * 自定义错误类型
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * 创建应用错误
 */
export function createError(
  message: string,
  code: string,
  statusCode?: number,
  details?: unknown
): AppError {
  return new AppError(message, code, statusCode, details);
}

/**
 * 判断是否为 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 将未知错误转换为 AppError
 */
export function toAppError(error: unknown, defaultCode = "UNKNOWN_ERROR"): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(error.message, defaultCode, 500, error.stack);
  }
  return new AppError(String(error), defaultCode, 500);
}

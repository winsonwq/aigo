// Session 存储层 - 使用 localStorage

import type { Session } from "./types";
import { SESSION_STORAGE_KEY, CURRENT_SESSION_KEY } from "./types";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

/**
 * 获取所有 Session
 */
export function getAllSessions(): Result<Session[]> {
  try {
    if (typeof window === "undefined") {
      return ok([]);
    }

    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return ok([]);
    }

    const sessions = JSON.parse(stored) as Session[];
    return ok(sessions);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get sessions")
    );
  }
}

/**
 * 获取单个 Session
 */
export function getSession(id: string): Result<Session | null> {
  try {
    const result = getAllSessions();
    if (!result.success) {
      return result;
    }

    const session = result.value.find((s) => s.id === id);
    return ok(session || null);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get session")
    );
  }
}

/**
 * 创建新 Session
 */
export function createSession(title?: string): Result<Session> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSessions();
    if (!result.success) {
      return result;
    }

    const sessions = result.value;
    const newSession: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: title || `新对话 ${sessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    sessions.unshift(newSession); // 新会话添加到最前面
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));

    return ok(newSession);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to create session")
    );
  }
}

/**
 * 更新 Session
 */
export function updateSession(session: Session): Result<Session> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSessions();
    if (!result.success) {
      return result;
    }

    const sessions = result.value;
    const index = sessions.findIndex((s) => s.id === session.id);
    
    if (index === -1) {
      return err(new Error("Session not found"));
    }

    sessions[index] = {
      ...session,
      updatedAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    return ok(sessions[index]);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to update session")
    );
  }
}

/**
 * 删除 Session
 */
export function deleteSession(id: string): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSessions();
    if (!result.success) {
      return result;
    }

    const sessions = result.value.filter((s) => s.id !== id);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));

    // 如果删除的是当前会话，清除当前会话 ID
    const currentSessionId = getCurrentSessionId();
    if (currentSessionId === id) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to delete session")
    );
  }
}

/**
 * 获取当前 Session ID
 */
export function getCurrentSessionId(): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * 设置当前 Session ID
 */
export function setCurrentSessionId(id: string | null): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    if (id === null) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } else {
      localStorage.setItem(CURRENT_SESSION_KEY, id);
    }

    // 触发自定义事件，通知其他组件 Session 已切换
    window.dispatchEvent(
      new CustomEvent("session-changed", { detail: { sessionId: id } })
    );

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to set current session")
    );
  }
}

/**
 * 更新 Session 标题（根据第一条用户消息自动生成）
 */
export function updateSessionTitle(sessionId: string, title: string): Result<Session> {
  try {
    const sessionResult = getSession(sessionId);
    if (!sessionResult.success || !sessionResult.value) {
      return err(new Error("Session not found"));
    }

    const updatedSession = {
      ...sessionResult.value,
      title: title.trim() || sessionResult.value.title,
    };

    return updateSession(updatedSession);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to update session title")
    );
  }
}

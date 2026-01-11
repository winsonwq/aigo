// Session 管理相关类型定义

import type { ChatMessage } from "@/components/chat/types";

/**
 * Session 数据结构
 */
export interface Session {
  id: string;
  title: string; // 会话标题（自动生成或用户自定义）
  messages: ChatMessage[]; // 对话消息列表
  createdAt: number; // 创建时间戳
  updatedAt: number; // 最后更新时间戳
}

/**
 * Session 存储键名
 */
export const SESSION_STORAGE_KEY = "aigo_sessions";

/**
 * 当前 Session ID 存储键名
 */
export const CURRENT_SESSION_KEY = "aigo_current_session_id";

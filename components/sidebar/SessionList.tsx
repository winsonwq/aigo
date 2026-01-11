"use client";

// Session 列表组件
// 显示所有会话，支持新建、切换、重命名、删除

import { useState, useEffect, useCallback } from "react";
import { HiChatBubbleLeftRight, HiPlus, HiPencil, HiTrash } from "react-icons/hi2";
import type { Session } from "@/lib/session/types";
import {
  getAllSessions,
  createSession,
  deleteSession,
  setCurrentSessionId,
  getCurrentSessionId,
  updateSessionTitle,
} from "@/lib/session/storage";
import ConfirmModal from "@/components/common/ConfirmModal";

interface SessionListProps {
  collapsed?: boolean;
  onSessionChange?: (sessionId: string) => void;
}

export default function SessionList({ collapsed = false, onSessionChange }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sessionId: string | null }>({
    isOpen: false,
    sessionId: null,
  });

  // 加载会话列表
  const loadSessions = useCallback(() => {
    const result = getAllSessions();
    if (result.success) {
      setSessions(result.value);
    }

    const currentId = getCurrentSessionId();
    setCurrentSessionIdState(currentId);
  }, []);

  // 初始化加载
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 监听 localStorage 变化（跨标签页同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aigo_sessions" || e.key === "aigo_current_session_id") {
        loadSessions();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [loadSessions]);

  // 新建会话
  const handleCreateSession = useCallback(() => {
    const result = createSession();
    if (result.success) {
      setCurrentSessionId(result.value.id);
      setCurrentSessionIdState(result.value.id);
      loadSessions();
      onSessionChange?.(result.value.id);
    }
  }, [loadSessions, onSessionChange]);

  // 切换会话
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setCurrentSessionId(sessionId);
      setCurrentSessionIdState(sessionId);
      onSessionChange?.(sessionId);
    },
    [onSessionChange]
  );

  // 开始编辑标题
  const handleStartEdit = useCallback((session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingTitle(session.title);
  }, []);

  // 保存标题编辑
  const handleSaveEdit = useCallback(
    (sessionId: string, e?: React.FormEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      const result = updateSessionTitle(sessionId, editingTitle);
      if (result.success) {
        setEditingId(null);
        setEditingTitle("");
        loadSessions();
      }
    },
    [editingTitle, loadSessions]
  );

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  // 打开删除确认对话框
  const handleOpenDeleteConfirm = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, sessionId });
  }, []);

  // 确认删除会话
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm.sessionId) return;

    const sessionId = deleteConfirm.sessionId;
    const result = deleteSession(sessionId);
    if (result.success) {
      loadSessions();

      // 如果删除的是当前会话，切换到第一个会话或创建新会话
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          handleSelectSession(remainingSessions[0].id);
        } else {
          handleCreateSession();
        }
      }
    }

    setDeleteConfirm({ isOpen: false, sessionId: null });
  }, [deleteConfirm.sessionId, currentSessionId, sessions, handleSelectSession, handleCreateSession, loadSessions]);

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, sessionId: null });
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* 新建会话按钮 */}
      {!collapsed && (
        <div className="border-b border-base-300 p-2">
          <button
            onClick={handleCreateSession}
            className="btn btn-primary btn-sm w-full gap-2"
          >
            <HiPlus className="h-4 w-4" />
            <span>新建对话</span>
          </button>
        </div>
      )}

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-base-content/60">
            <HiChatBubbleLeftRight className="mb-2 h-8 w-8" />
            {!collapsed && <p>还没有会话</p>}
            {!collapsed && (
              <button
                onClick={handleCreateSession}
                className="btn btn-ghost btn-sm mt-2"
              >
                创建第一个会话
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const isEditing = editingId === session.id;

              return (
                <li key={session.id}>
                  <div
                    onClick={() => !isEditing && handleSelectSession(session.id)}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-content"
                        : "hover:bg-base-300 cursor-pointer"
                    }`}
                  >
                    <HiChatBubbleLeftRight className="h-4 w-4 flex-shrink-0" />

                    {collapsed ? (
                      <span className="sr-only">{session.title}</span>
                    ) : (
                      <>
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleSaveEdit(session.id, e)}
                            className="flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleSaveEdit(session.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                              className={`input input-sm w-full ${
                                isActive
                                  ? "bg-base-100 text-base-content border-primary"
                                  : "bg-base-100 text-base-content"
                              }`}
                              autoFocus
                            />
                          </form>
                        ) : (
                          <span className="flex-1 truncate text-sm">{session.title}</span>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={(e) => handleStartEdit(session, e)}
                              className="btn btn-ghost btn-xs"
                              title="重命名"
                            >
                              <HiPencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => handleOpenDeleteConfirm(session.id, e)}
                              className="btn btn-ghost btn-xs text-error"
                              title="删除"
                            >
                              <HiTrash className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 删除确认对话框 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除会话"
        message="确定要删除这个会话吗？删除后无法恢复。"
        confirmText="删除"
        cancelText="取消"
        confirmButtonType="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

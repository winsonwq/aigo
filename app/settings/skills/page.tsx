"use client";

import { useState, useCallback } from "react";
import { HiPlus, HiArrowPath } from "react-icons/hi2";
import type { SkillConfig } from "@/lib/skills/types";
import SkillsList from "@/components/settings/SkillsList";
import SkillForm from "@/components/settings/SkillForm";

export default function SkillsSettingsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // 触发子组件刷新
    window.dispatchEvent(new CustomEvent("skill-refresh"));
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleOpenAddForm = useCallback(() => {
    setEditingSkill(null);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingSkill(null);
    // 刷新列表
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Skills 配置</h1>
            <p className="text-sm text-base-content/70">
              配置和管理 Anthropic Agent Skills（文档化指令集）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
              title="刷新"
            >
              <HiArrowPath
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>刷新</span>
            </button>
            <button
              className="btn btn-sm btn-primary gap-2"
              onClick={handleOpenAddForm}
            >
              <HiPlus className="h-4 w-4" />
              <span>添加</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <SkillsList
          onEdit={(skill) => {
            setEditingSkill(skill);
            setIsFormOpen(true);
          }}
        />
      </div>

      {/* 添加/编辑表单 */}
      {isFormOpen && (
        <SkillForm skill={editingSkill} onClose={handleCloseForm} />
      )}
    </div>
  );
}

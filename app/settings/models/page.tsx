"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { HiArrowLeft, HiPlus, HiArrowPath } from "react-icons/hi2";
import type { ModelConfig } from "@/lib/models/types";
import ModelList from "@/components/settings/ModelList";
import ModelForm from "@/components/settings/ModelForm";

export default function ModelsSettingsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // 触发子组件刷新
    window.dispatchEvent(new CustomEvent("model-refresh"));
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleOpenAddForm = useCallback(() => {
    setEditingModel(null);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingModel(null);
    // 刷新列表
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="btn btn-ghost btn-sm btn-circle"
              title="返回设置"
            >
              <HiArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">模型配置</h1>
              <p className="text-sm text-base-content/70">配置和管理多个 LLM 模型</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
              title="刷新"
            >
              <HiArrowPath className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>刷新</span>
            </button>
            <button className="btn btn-sm btn-primary gap-2" onClick={handleOpenAddForm}>
              <HiPlus className="h-4 w-4" />
              <span>添加</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <ModelList onEdit={(model) => {
          setEditingModel(model);
          setIsFormOpen(true);
        }} />
      </div>

      {/* 添加/编辑表单 */}
      {isFormOpen && (
        <ModelForm model={editingModel} onClose={handleCloseForm} />
      )}
    </div>
  );
}

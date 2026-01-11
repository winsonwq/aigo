"use client";

// 模型配置列表组件
// 显示所有模型配置，支持添加、编辑、删除、设置默认模型

import { useState, useEffect, useCallback } from "react";
import { HiPencil, HiTrash } from "react-icons/hi2";
import type { ModelConfig } from "@/lib/models/types";
import {
  getAllModels,
  deleteModel,
  getDefaultModelId,
  setDefaultModelId,
} from "@/lib/models/storage";
import ConfirmModal from "@/components/common/ConfirmModal";

interface ModelListProps {
  onEdit?: (model: ModelConfig) => void;
}

export default function ModelList({ onEdit }: ModelListProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [defaultModelId, setDefaultModelIdState] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; modelId: string | null }>({
    isOpen: false,
    modelId: null,
  });
  const [loading, setLoading] = useState(false);

  // 加载模型列表
  const loadModels = useCallback(() => {
    setLoading(true);
    const result = getAllModels();
    if (result.success) {
      setModels(result.value);
    }

    const defaultId = getDefaultModelId();
    setDefaultModelIdState(defaultId);
    setLoading(false);
  }, []);

  // 初始化加载
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 监听刷新事件和 localStorage 变化
  useEffect(() => {
    const handleRefresh = () => {
      loadModels();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aigo_models" || e.key === "aigo_default_model_id") {
        loadModels();
      }
    };

    window.addEventListener("model-refresh", handleRefresh);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("model-refresh", handleRefresh);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadModels]);

  // 打开编辑表单
  const handleOpenEditForm = useCallback(
    (model: ModelConfig) => {
      onEdit?.(model);
    },
    [onEdit]
  );

  // 设置默认模型
  const handleSetDefault = useCallback(
    (modelId: string) => {
      const result = setDefaultModelId(modelId);
      if (result.success) {
        setDefaultModelIdState(modelId);
      }
    },
    []
  );

  // 打开删除确认对话框
  const handleOpenDeleteConfirm = useCallback((modelId: string) => {
    setDeleteConfirm({ isOpen: true, modelId });
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm.modelId) return;

    const result = deleteModel(deleteConfirm.modelId);
    if (result.success) {
      loadModels();
    }

    setDeleteConfirm({ isOpen: false, modelId: null });
  }, [deleteConfirm.modelId, loadModels]);

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, modelId: null });
  }, []);

  return (
    <>
      <div className="card card-bordered bg-base-100 shadow-sm">
        <div className="card-body">

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
              <span className="ml-2">加载配置列表中...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <p>暂无 AI 配置</p>
              <p className="text-sm mt-2">点击【添加】按钮添加配置</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>Base URL</th>
                    <th>API Key</th>
                    <th>Model</th>
                    <th className="text-center">默认</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.id}>
                      <td className="font-medium">{model.name}</td>
                      <td>
                        <div className="max-w-xs truncate" title={model.base_url}>
                          {model.base_url}
                        </div>
                      </td>
                      <td>
                        <div className="font-mono text-sm">
                          {model.api_key.substring(0, 10)}...
                        </div>
                      </td>
                      <td>{model.model}</td>
                      <td className="text-center">
                        {defaultModelId === model.id ? (
                          <div className="badge badge-primary">默认</div>
                        ) : (
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleSetDefault(model.id)}
                            title="设为默认"
                          >
                            设为默认
                          </button>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenEditForm(model)}
                            title="编辑"
                          >
                            <HiPencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() => handleOpenDeleteConfirm(model.id)}
                            title="删除"
                          >
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


      {/* 删除确认对话框 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除模型配置"
        message="确定要删除这个模型配置吗？删除后无法恢复。"
        confirmText="删除"
        cancelText="取消"
        confirmButtonType="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

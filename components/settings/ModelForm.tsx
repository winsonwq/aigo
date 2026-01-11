"use client";

// 模型配置添加/编辑表单组件

import { useState, useEffect, useRef } from "react";
import type { ModelConfig } from "@/lib/models/types";
import { createModel, updateModel } from "@/lib/models/storage";

interface ModelFormProps {
  model: ModelConfig | null; // null 表示添加模式，非 null 表示编辑模式
  onClose: () => void;
}

export default function ModelForm({ model, onClose }: ModelFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!model;

  // 初始化表单数据
  useEffect(() => {
    if (model) {
      setName(model.name);
      setBaseUrl(model.base_url);
      setApiKey(model.api_key);
      setModelName(model.model);
    } else {
      // 重置表单
      setName("");
      setBaseUrl("");
      setApiKey("");
      setModelName("");
    }
    setError(null);
  }, [model]);

  // 控制 modal 显示
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, []);

  // 提交表单
  const handleSave = () => {
    setError(null);

    // 验证必填字段
    if (!name.trim()) {
      setError("请填写所有字段");
      return;
    }
    if (!baseUrl.trim()) {
      setError("请填写所有字段");
      return;
    }
    if (!apiKey.trim()) {
      setError("请填写所有字段");
      return;
    }
    if (!modelName.trim()) {
      setError("请填写所有字段");
      return;
    }

    const modelData: Omit<ModelConfig, "id" | "created_at" | "updated_at"> = {
      name: name.trim(),
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      model: modelName.trim(),
    };

    if (model) {
      // 编辑模式
      const result = updateModel({
        ...modelData,
        id: model.id,
        created_at: model.created_at,
        updated_at: new Date().toISOString(),
      });
      if (!result.success) {
        setError(result.error instanceof Error ? result.error.message : "更新失败");
        return;
      }
    } else {
      // 添加模式
      const result = createModel(modelData);
      if (!result.success) {
        setError(result.error instanceof Error ? result.error.message : "创建失败");
        return;
      }
    }

    onClose();
  };

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {isEditMode ? "编辑 AI 配置" : "添加 AI 配置"}
        </h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">名称</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="配置名称"
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Base URL</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">API Key</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Model</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gpt-3.5-turbo"
            />
          </div>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}

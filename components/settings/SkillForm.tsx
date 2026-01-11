"use client";

// Skill 配置添加/编辑表单组件

import { useState, useEffect, useRef } from "react";
import type { SkillConfig } from "@/lib/skills/types";
import { createSkillConfig, updateSkillConfig } from "@/lib/skills/storage";

interface SkillFormProps {
  skill: SkillConfig | null; // null 表示添加模式，非 null 表示编辑模式
  onClose: () => void;
}

export default function SkillForm({ skill, onClose }: SkillFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!skill;

  // 初始化表单数据
  useEffect(() => {
    if (skill) {
      setPath(skill.path);
      setIsRemote(skill.isRemote);
      setEnabled(skill.enabled);
    } else {
      // 重置表单
      setPath("");
      setIsRemote(false);
      setEnabled(true);
    }
    setError(null);
  }, [skill]);

  // 控制 modal 显示
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, []);

  // 验证路径格式
  const validatePath = (pathValue: string, isRemoteValue: boolean): boolean => {
    if (!pathValue.trim()) {
      return false;
    }

    if (isRemoteValue) {
      // 验证 URL 格式
      try {
        new URL(pathValue);
        return true;
      } catch {
        return false;
      }
    } else {
      // 本地路径：至少应该是一个有效的路径格式
      return pathValue.trim().length > 0;
    }
  };

  // 提交表单
  const handleSave = () => {
    setError(null);

    // 验证必填字段
    if (!path.trim()) {
      setError("请填写路径或 URL");
      return;
    }

    if (!validatePath(path, isRemote)) {
      setError(
        isRemote
          ? "请输入有效的 URL（例如：https://example.com/skills/my-skill）"
          : "请输入有效的本地路径（例如：/path/to/skill 或 ./skills/my-skill）"
      );
      return;
    }

    const skillData: Omit<SkillConfig, "id" | "updatedAt"> = {
      path: path.trim(),
      isRemote: isRemote,
      enabled: enabled,
    };

    if (skill) {
      // 编辑模式
      const result = updateSkillConfig({
        ...skillData,
        id: skill.id,
        updatedAt: Date.now(),
      });
      if (!result.success) {
        setError(
          result.error instanceof Error
            ? result.error.message
            : "更新失败"
        );
        return;
      }
    } else {
      // 添加模式
      const result = createSkillConfig(skillData);
      if (!result.success) {
        setError(
          result.error instanceof Error
            ? result.error.message
            : "创建失败"
        );
        return;
      }
    }

    onClose();
  };

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {isEditMode ? "编辑 Skill 配置" : "添加 Skill 配置"}
        </h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">路径类型</span>
            </label>
            <div className="flex gap-4">
              <label className="label cursor-pointer">
                <input
                  type="radio"
                  name="pathType"
                  className="radio radio-primary"
                  checked={!isRemote}
                  onChange={() => setIsRemote(false)}
                />
                <span className="label-text ml-2">本地路径</span>
              </label>
              <label className="label cursor-pointer">
                <input
                  type="radio"
                  name="pathType"
                  className="radio radio-primary"
                  checked={isRemote}
                  onChange={() => setIsRemote(true)}
                />
                <span className="label-text ml-2">远程 URL</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">
              <span className="label-text">
                {isRemote ? "URL" : "本地路径"}
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={
                isRemote
                  ? "https://example.com/skills/my-skill"
                  : "/path/to/skill 或 ./skills/my-skill"
              }
            />
            <label className="label">
              <span className="label-text-alt">
                {isRemote
                  ? "远程 Skill 的 URL（应指向包含 SKILL.md 的目录）"
                  : "本地 Skill 目录路径（应包含 SKILL.md 文件）"}
              </span>
            </label>
          </div>

          <div>
            <label className="label cursor-pointer">
              <span className="label-text">启用</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            </label>
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

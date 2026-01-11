"use client";

// Skills 配置列表组件
// 显示所有 Skills 配置，支持添加、编辑、删除、启用/禁用

import { useState, useEffect, useCallback } from "react";
import { HiPencil, HiTrash } from "react-icons/hi2";
import type { SkillConfig } from "@/lib/skills/types";
import {
  getAllSkillConfigs,
  deleteSkillConfig,
  updateSkillConfig,
} from "@/lib/skills/storage";
import ConfirmModal from "@/components/common/ConfirmModal";

interface SkillsListProps {
  onEdit?: (skill: SkillConfig) => void;
}

export default function SkillsList({ onEdit }: SkillsListProps) {
  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    skillId: string | null;
  }>({
    isOpen: false,
    skillId: null,
  });
  const [loading, setLoading] = useState(false);

  // 加载 Skills 列表
  const loadSkills = useCallback(() => {
    setLoading(true);
    const result = getAllSkillConfigs();
    if (result.success) {
      setSkills(result.value);
    }
    setLoading(false);
  }, []);

  // 初始化加载
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // 监听刷新事件和 localStorage 变化
  useEffect(() => {
    const handleRefresh = () => {
      loadSkills();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aigo_skills") {
        loadSkills();
      }
    };

    window.addEventListener("skill-refresh", handleRefresh);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("skill-refresh", handleRefresh);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadSkills]);

  // 打开编辑表单
  const handleOpenEditForm = useCallback(
    (skill: SkillConfig) => {
      onEdit?.(skill);
    },
    [onEdit]
  );

  // 切换启用/禁用状态
  const handleToggleEnabled = useCallback(
    (skill: SkillConfig) => {
      const result = updateSkillConfig({
        ...skill,
        enabled: !skill.enabled,
      });
      if (result.success) {
        loadSkills();
      }
    },
    [loadSkills]
  );

  // 打开删除确认对话框
  const handleOpenDeleteConfirm = useCallback((skillId: string) => {
    setDeleteConfirm({ isOpen: true, skillId });
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm.skillId) return;

    const result = deleteSkillConfig(deleteConfirm.skillId);
    if (result.success) {
      loadSkills();
    }

    setDeleteConfirm({ isOpen: false, skillId: null });
  }, [deleteConfirm.skillId, loadSkills]);

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, skillId: null });
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
          ) : skills.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <p>暂无 Skills 配置</p>
              <p className="text-sm mt-2">点击【添加】按钮添加配置</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>路径/URL</th>
                    <th>类型</th>
                    <th className="text-center">状态</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill) => (
                    <tr key={skill.id}>
                      <td className="font-medium">{skill.id}</td>
                      <td>
                        <div className="max-w-xs truncate" title={skill.path}>
                          {skill.path}
                        </div>
                      </td>
                      <td>
                        {skill.isRemote ? (
                          <div className="badge badge-info">远程</div>
                        ) : (
                          <div className="badge badge-secondary">本地</div>
                        )}
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="toggle toggle-sm"
                          checked={skill.enabled}
                          onChange={() => handleToggleEnabled(skill)}
                          title={skill.enabled ? "禁用" : "启用"}
                        />
                      </td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenEditForm(skill)}
                            title="编辑"
                          >
                            <HiPencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() => handleOpenDeleteConfirm(skill.id)}
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
        title="删除 Skill 配置"
        message="确定要删除这个 Skill 配置吗？删除后无法恢复。"
        confirmText="删除"
        cancelText="取消"
        confirmButtonType="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

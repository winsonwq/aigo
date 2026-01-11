"use client";

export default function GeneralSettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <div>
          <h1 className="text-2xl font-bold">基础设置</h1>
          <p className="text-sm text-base-content/70">系统基础配置和通用设置</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card card-bordered bg-base-100">
          <div className="card-body">
            <h2 className="card-title">基础设置</h2>
            <p className="text-base-content/70">基础设置功能开发中...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

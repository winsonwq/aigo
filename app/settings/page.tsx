"use client";

import Link from "next/link";
import { HiCog6Tooth, HiServer, HiCodeBracket, HiCpuChip } from "react-icons/hi2";

interface SettingsCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function SettingsCard({ title, description, href, icon: Icon }: SettingsCardProps) {
  return (
    <Link
      href={href}
      className="card card-bordered bg-base-100 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="card-body">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="card-title text-lg">{title}</h3>
            <p className="text-sm text-base-content/70">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SettingsPage() {
  const settingsCategories = [
    {
      title: "基础设置",
      description: "系统基础配置和通用设置",
      href: "/settings/general",
      icon: HiCog6Tooth,
    },
    {
      title: "MCP 配置",
      description: "配置和管理 MCP Server，集成外部工具",
      href: "/settings/mcp",
      icon: HiServer,
    },
    {
      title: "Skills 配置",
      description: "自定义技能扩展，增强 Agent 能力",
      href: "/settings/skills",
      icon: HiCodeBracket,
    },
    {
      title: "模型配置",
      description: "配置和管理多个 LLM 模型",
      href: "/settings/models",
      icon: HiCpuChip,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-base-content/70">系统配置管理</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsCategories.map((category) => (
              <SettingsCard
                key={category.href}
                title={category.title}
                description={category.description}
                href={category.href}
                icon={category.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

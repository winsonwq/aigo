"use client";

import { useState, useRef, useEffect } from "react";
import {
  HiBars3,
  HiMagnifyingGlass,
  HiPencil,
  HiCog6Tooth,
  HiServer,
  HiCodeBracket,
  HiCpuChip,
} from "react-icons/hi2";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SessionList from "@/components/sidebar/SessionList";
import { createSession, setCurrentSessionId } from "@/lib/session/storage";

interface SettingsMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const settingsMenuItems: SettingsMenuItem[] = [
    {
      name: "基础设置",
      href: "/settings/general",
      icon: HiCog6Tooth,
    },
    {
      name: "MCP 配置",
      href: "/settings/mcp",
      icon: HiServer,
    },
    {
      name: "Skills 配置",
      href: "/settings/skills",
      icon: HiCodeBracket,
    },
    {
      name: "模型配置",
      href: "/settings/models",
      icon: HiCpuChip,
    },
  ];

  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  const isSettingsPage = pathname.startsWith("/settings");

  // 点击外部关闭 dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSettingsDropdownOpen(false);
      }
    };

    if (isSettingsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSettingsDropdownOpen]);

  // 处理新建会话
  const handleNewChat = () => {
    const result = createSession();
    if (result.success) {
      setCurrentSessionId(result.value.id);
      // 导航到聊天页面
      router.push("/chat");
    }
  };

  return (
    <div
      className={`h-screen bg-base-200 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-full flex-col">
        {/* 顶部区域：汉堡菜单、搜索、New Chat 按钮 */}
        <div className="border-b border-base-300">
          {/* 顶部工具栏 */}
          <div className="flex h-12 items-center justify-between px-3 gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="btn btn-ghost btn-sm btn-square"
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              <HiBars3 className="h-5 w-5" />
            </button>
            {!collapsed && (
              <button
                className="btn btn-ghost btn-sm btn-square"
                title="搜索"
              >
                <HiMagnifyingGlass className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* New Chat 按钮 */}
          {!collapsed && (
            <div className="px-3 pb-3">
              <button
                onClick={handleNewChat}
                className="btn btn-primary btn-sm w-full gap-2"
              >
                <HiPencil className="h-4 w-4" />
                <span>新的对话</span>
              </button>
            </div>
          )}
        </div>

        {/* 中间区域：Chats 列表（始终显示） */}
        <div className="flex-1 overflow-hidden flex flex-col border-b border-base-300">
            {!collapsed && (
              <div className="px-3 py-2 text-sm font-semibold text-base-content/70">
                会话
              </div>
            )}
          <div className="flex-1 overflow-hidden">
            <SessionList collapsed={collapsed} />
          </div>
        </div>

        {/* 底部区域：Settings & help */}
        <div className="border-t border-base-300 p-3">
          <div
            className={`dropdown dropdown-top w-full ${isSettingsDropdownOpen ? "dropdown-open" : ""}`}
            ref={settingsDropdownRef}
          >
            <button
              tabIndex={0}
              role="button"
              onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
              className={`btn btn-ghost btn-sm w-full ${
                collapsed ? "btn-square" : "justify-start gap-2"
              } ${isSettingsPage ? "btn-active" : ""}`}
              title={collapsed ? "设置" : undefined}
            >
              <HiCog6Tooth className="h-5 w-5" />
              {!collapsed && <span>设置</span>}
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-200 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300 mb-2"
            >
              {settingsMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={isActive ? "active" : ""}
                      onClick={() => setIsSettingsDropdownOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

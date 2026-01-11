"use client";

import { useState, useEffect } from "react";
import {
  HiChatBubbleLeftRight,
  HiCog6Tooth,
  HiServer,
  HiCodeBracket,
  HiCpuChip,
  HiChevronDown,
  HiChevronRight,
} from "react-icons/hi2";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SessionList from "@/components/sidebar/SessionList";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  const menuItems: MenuItem[] = [
    {
      name: "Chat",
      href: "/chat",
      icon: HiChatBubbleLeftRight,
    },
    {
      name: "设置",
      href: "/settings",
      icon: HiCog6Tooth,
      children: [
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
      ],
    },
  ];

  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  const isSettingsPage = pathname.startsWith("/settings");

  // 自动展开当前激活的菜单
  useEffect(() => {
    if (isSettingsPage) {
      setExpandedMenus(new Set(["设置"]));
    }
  }, [pathname, isSettingsPage]);

  // 切换菜单展开/折叠
  const toggleMenu = (menuName: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuName)) {
      newExpanded.delete(menuName);
    } else {
      newExpanded.add(menuName);
    }
    setExpandedMenus(newExpanded);
  };

  return (
    <div
      className={`h-screen bg-base-200 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-base-300 px-4">
          {!collapsed && <h1 className="text-xl font-bold">AIGO</h1>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn btn-ghost btn-sm"
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* 菜单区域 */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedMenus.has(item.name);

              return (
                <li key={item.name}>
                  <div>
                    {hasChildren ? (
                      <>
                        <button
                          onClick={() => !collapsed && toggleMenu(item.name)}
                          className={`flex items-center gap-3 rounded-lg px-4 py-3 w-full transition-colors ${
                            isActive
                              ? "bg-primary text-primary-content"
                              : "hover:bg-base-300"
                          }`}
                          title={collapsed ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left">{item.name}</span>
                              {isExpanded ? (
                                <HiChevronDown className="h-4 w-4" />
                              ) : (
                                <HiChevronRight className="h-4 w-4" />
                              )}
                            </>
                          )}
                        </button>
                        {!collapsed && isExpanded && item.children && (
                          <ul className="ml-4 mt-1 space-y-1">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive =
                                pathname === child.href || pathname.startsWith(child.href + "/");

                              return (
                                <li key={child.name}>
                                  <Link
                                    href={child.href}
                                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                                      isChildActive
                                        ? "bg-primary/20 text-primary"
                                        : "hover:bg-base-300"
                                    }`}
                                  >
                                    <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                    <span>{child.name}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                          isActive
                            ? "bg-primary text-primary-content"
                            : "hover:bg-base-300"
                        }`}
                        title={collapsed ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Chat 页面时在底部显示 Session 列表 */}
        {isChatPage && (
          <div className="border-t border-base-300 flex-1 overflow-hidden flex flex-col">
            <SessionList collapsed={collapsed} />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { HiChatBubbleLeftRight, HiCog6Tooth } from "react-icons/hi2";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    {
      name: "Chat",
      href: "/chat",
      icon: HiChatBubbleLeftRight,
    },
    {
      name: "设置",
      href: "/settings",
      icon: HiCog6Tooth,
    },
  ];

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

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              
              return (
                <li key={item.name}>
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
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

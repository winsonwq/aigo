import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Page from "@/components/layout/Page";

export const metadata: Metadata = {
  title: "AIGO - AI Chat with ReAct Agent",
  description: "AI 聊天工具，所有对话都支持 ReAct Agent 模式",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="light">
      <body>
        <div className="flex h-screen">
          <Sidebar />
          <Page>{children}</Page>
        </div>
      </body>
    </html>
  );
}

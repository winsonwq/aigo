"use client";

// 单条消息组件
// 根据消息类型渲染不同的消息组件

import UserMessage from "./UserMessage";
import AIMessage from "./AIMessage";
import type { ChatMessage } from "./types";

interface MessageItemProps {
  message: ChatMessage;
}

export default function MessageItem({ message }: MessageItemProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }

  if (message.role === "assistant") {
    return <AIMessage message={message} />;
  }

  // system 消息暂不显示
  return null;
}

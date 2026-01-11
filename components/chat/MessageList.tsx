"use client";

// 消息列表组件

import MessageItem from "./MessageItem";
import type { ChatMessage } from "./types";

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-base-content/60">开始对话...</p>
          <p className="mt-2 text-sm text-base-content/40">
            输入消息开始与 AI 对话
          </p>
        </div>
      </div>
    );
  }

  // 找到最后一个用户消息的索引
  let lastUserMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserMessageIndex = i;
      break;
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((message, index) => (
        <MessageItem 
          key={message.id} 
          message={message} 
          isLastUserMessage={message.role === "user" && index === lastUserMessageIndex}
        />
      ))}
    </div>
  );
}

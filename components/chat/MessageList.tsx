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

  return (
    <div className="flex justify-center w-full">
      <div className="w-full max-w-[60%]">
        <div className="flex flex-col gap-4 p-4">
          {messages.map((message) => (
            <MessageItem 
              key={message.id} 
              message={message}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

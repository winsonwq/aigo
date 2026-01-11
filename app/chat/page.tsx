import ChatContainer from "@/components/chat/ChatContainer";

export default function AgentsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-sm text-base-content/70">AI 对话界面</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatContainer />
      </div>
    </div>
  );
}

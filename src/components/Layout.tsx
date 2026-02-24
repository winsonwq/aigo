import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { OpenCodeNotification } from "./OpenCodeNotification";
import { useWorkspace } from "@/context/WorkspaceContext";

/** 切换 workspace 时若当前在会话页，则回到首页，避免用旧 sessionId 在新区间拉消息导致「未连接或缺少 sessionId」。 */
function useRedirectSessionToHomeOnWorkspaceChange() {
  const { workspacePath } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const prevWorkspacePathRef = useRef(workspacePath);

  useEffect(() => {
    if (prevWorkspacePathRef.current === workspacePath) return;
    prevWorkspacePathRef.current = workspacePath;
    if (location.pathname.startsWith("/session/")) {
      navigate("/", { replace: true });
    }
  }, [workspacePath, location.pathname, navigate]);
}

export function Layout() {
  useRedirectSessionToHomeOnWorkspaceChange();

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-transparent">
          <Outlet />
        </main>
      </div>
      <OpenCodeNotification />
    </div>
  );
}

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { OpenCodeNotification } from "./OpenCodeNotification";

export function Layout() {
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

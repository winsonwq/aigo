import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { OpenCodeProvider } from "@/context/OpenCodeContext";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Session } from "@/pages/Session";
import { Settings } from "@/pages/Settings";
import { Skills } from "@/pages/Skills";
import "./App.css";
import "./styles/markdown.css";

function App() {
  return (
    <WorkspaceProvider>
      <OpenCodeProvider>
      <ConfirmModalProvider>
        <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="session/:id" element={<Session />} />
            <Route path="settings" element={<Settings />} />
            <Route path="skills" element={<Skills />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
      </ConfirmModalProvider>
    </OpenCodeProvider>
    </WorkspaceProvider>
  );
}

export default App;

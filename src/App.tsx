import { Provider } from "react-redux";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { store } from "@/store";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { OpenCodeProvider } from "@/context/OpenCodeContext";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Session } from "@/pages/Session";
import { Settings } from "@/pages/Settings";
import { Skills } from "@/pages/Skills";
import "./App.css";
import "./styles/markdown.css";

function App() {
  return (
    <Provider store={store}>
      <WorkspaceProvider>
        <OpenCodeProvider>
          <ConfirmModalProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="session/:id" element={<Session />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="skills" element={<Skills />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster />
          </ConfirmModalProvider>
        </OpenCodeProvider>
      </WorkspaceProvider>
    </Provider>
  );
}

export default App;

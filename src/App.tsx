import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { OpenCodeProvider } from "@/context/OpenCodeContext";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Session } from "@/pages/Session";
import { Settings } from "@/pages/Settings";
import { Skills } from "@/pages/Skills";
import "./App.css";
import "./styles/markdown.css";

function App() {
  return (
    <OpenCodeProvider>
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
    </OpenCodeProvider>
  );
}

export default App;

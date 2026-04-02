import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { MainLayout } from "@/components/layout/main-layout";
import { ProjectLayout } from "@/components/layout/project-layout";
import { SyncedLayout } from "@/components/layout/synced-layout";
import { LoginPage } from "@/pages/login-page";
import { ProjectDashboardPage } from "@/pages/project-dashboard-page";
import { ProjectsPage } from "@/pages/projects-page";
import { RegisterPage } from "@/pages/register-page";
import { RunsPage } from "@/pages/runs-page";
import { TestCasesPage } from "@/pages/test-cases-page";
import { useAuthStore } from "@/store/auth-store";

function AuthBootstrap() {
  useEffect(() => {
    return useAuthStore.getState().init();
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<SyncedLayout />}>
            <Route element={<MainLayout />}>
              <Route path="/projects" element={<ProjectsPage />} />
            </Route>
            <Route path="/projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectDashboardPage />} />
              <Route path="test-cases" element={<TestCasesPage />} />
              <Route path="runs" element={<RunsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

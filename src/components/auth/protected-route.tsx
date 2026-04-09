import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/store/auth-store";

export function ProtectedRoute() {
  const account = useAuthStore((s) => s.account);
  const authLoading = useAuthStore((s) => s.authLoading);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!account) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Đang tải...</p>;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = usePermission();
  if (!can(permission)) return <p style={{ padding: 24 }}>403 — Không có quyền: {permission}</p>;
  return <>{children}</>;
}

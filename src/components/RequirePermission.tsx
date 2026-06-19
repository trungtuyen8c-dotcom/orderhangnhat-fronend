import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Spin, Result } from "antd";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}><Spin size="large" /></div>;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = usePermission();
  if (!can(permission)) return <Result status="403" title="403" subTitle={`Không có quyền: ${permission}`} />;
  return <>{children}</>;
}

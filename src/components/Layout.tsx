import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";

const MENU: { to: string; label: string; perm?: string }[] = [
  { to: "/", label: "Dashboard" },
  { to: "/orders", label: "Đơn hàng", perm: "orders.list" },
  { to: "/customers", label: "Khách hàng", perm: "customers.list" },
  { to: "/tracking", label: "Tracking", perm: "trackings.list" },
  { to: "/shipments", label: "Chuyến & Chứng từ", perm: "shipments.list" },
  { to: "/accounting", label: "Kế toán", perm: "accounting.reconcile" },
  { to: "/warehouse", label: "Kho VN", perm: "warehouse.weigh_vn" },
  { to: "/admin", label: "Quản trị", perm: "users.list" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const { can } = usePermission();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Order Hàng Nhật</h1>
        <nav>
          {MENU.filter((m) => !m.perm || can(m.perm)).map((m) => (
            <NavLink key={m.to} to={m.to} end={m.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user">{me?.fullName ?? me?.email}<br />{me?.roles.join(", ")}</div>
        <button className="btn gray" onClick={logout}>Đăng xuất</button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

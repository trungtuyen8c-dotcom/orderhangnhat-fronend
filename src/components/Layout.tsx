import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Avatar, Dropdown, Modal, Form, Input, App, Badge, Popover, List, Button } from "antd";
import {
  DashboardOutlined, ShoppingCartOutlined, TeamOutlined,
  ContainerOutlined, DollarOutlined, InboxOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, KeyOutlined, BellOutlined, DownOutlined, SearchOutlined, CloudUploadOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";
import { api } from "../api";

const { Header, Sider, Content } = AntLayout;

interface NavItem { key: string; icon: ReactNode; label: string; perm?: string }
const GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [{ key: "/", icon: <DashboardOutlined />, label: "Dashboard" }] },
  { title: "Vận hành", items: [
    { key: "/orders", icon: <ShoppingCartOutlined />, label: "Đơn hàng", perm: "orders.list" },
    { key: "/customers", icon: <TeamOutlined />, label: "Khách hàng", perm: "customers.list" },
  ] },
  { title: "Kho & Vận chuyển", items: [
    { key: "/warehouse-jp", icon: <InboxOutlined />, label: "Kho Nhật", perm: "warehouse.weigh_jp" },
    { key: "/shipments", icon: <ContainerOutlined />, label: "Chuyến & Chứng từ & Đánh giá", perm: "shipments.list" },
    { key: "/warehouse", icon: <InboxOutlined />, label: "Kho VN", perm: "warehouse.weigh_vn" },
  ] },
  { title: "Tài chính", items: [
    { key: "/accounting", icon: <DollarOutlined />, label: "Kế toán", perm: "accounting.reconcile" },
  ] },
  { title: "Hệ thống", items: [
    { key: "/admin", icon: <SettingOutlined />, label: "Quản trị", perm: "users.list" },
    { key: "/backup", icon: <CloudUploadOutlined />, label: "Backup", perm: "system.manage_settings" },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.items);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const { can } = usePermission();
  const nav = useNavigate();
  const loc = useLocation();
  const { message } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [alerts, setAlerts] = useState<{ code: string }[]>([]);
  const [q, setQ] = useState("");
  const [form] = Form.useForm();

  useEffect(() => {
    api.get<{ orders: { code: string }[] }>("/stats/alerts").then((r) => setAlerts(r.data.orders ?? [])).catch(() => {});
  }, []);

  const menuItems = useMemo(() => {
    const toItem = (m: NavItem) => ({ key: m.key, icon: m.icon, label: m.label });
    if (q.trim()) {
      const nq = norm(q);
      return ALL.filter((m) => (!m.perm || can(m.perm)) && norm(m.label).includes(nq)).map(toItem);
    }
    const out: any[] = [];
    for (const g of GROUPS) {
      const vis = g.items.filter((m) => !m.perm || can(m.perm));
      if (!vis.length) continue;
      if (g.title && !collapsed) out.push({ type: "group", label: g.title, children: vis.map(toItem) });
      else out.push(...vis.map(toItem));
    }
    return out;
  }, [q, collapsed, can]);
  const current = ALL.find((m) => m.key === loc.pathname)?.label ?? "";

  async function changePw() {
    const v = await form.validateFields();
    try {
      await api.post("/auth/change-password", v);
      message.success("Đổi mật khẩu thành công, đăng nhập lại");
      setPwOpen(false);
      await logout();
    } catch { message.error("Mật khẩu cũ không đúng"); }
  }

  const bell = (
    <Popover
      trigger="click" placement="bottomRight"
      title="Cảnh báo đơn quá 7 ngày chưa tracking"
      content={
        <List size="small" style={{ width: 260 }} locale={{ emptyText: "Không có cảnh báo" }}
          dataSource={alerts} renderItem={(o) => <List.Item>{o.code}</List.Item>} />
      }
    >
      <Badge count={alerts.length} size="small">
        <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Popover>
  );

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider className="app-sider" theme="light" collapsible collapsed={collapsed} onCollapse={setCollapsed} width={236}>
        <div className="app-logo"><span className="dot">日</span>{!collapsed && <span>Order Hàng Nhật</span>}</div>
        {!collapsed && (
          <div className="sider-search">
            <Input allowClear value={q} onChange={(e) => setQ(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />} placeholder="Tìm menu..." />
          </div>
        )}
        <Menu mode="inline" selectedKeys={[loc.pathname]} items={menuItems} onClick={(e) => nav(e.key)} />
        {q.trim() && !menuItems.length && <div className="sider-empty">Không có mục khớp</div>}
      </Sider>
      <AntLayout>
        <Header className="site-header">
          <span className="page-title">{current}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {bell}
            <Dropdown menu={{ items: [
              { key: "pw", icon: <KeyOutlined />, label: "Đổi mật khẩu", onClick: () => setPwOpen(true) },
              { type: "divider" },
              { key: "out", icon: <LogoutOutlined />, label: "Đăng xuất", onClick: logout, danger: true },
            ] }}>
              <span className="header-user">
                <Avatar size={32} icon={<UserOutlined />} style={{ background: "#4f46e5" }} />
                <span style={{ fontWeight: 500 }}>{me?.fullName ?? me?.email}</span>
                <DownOutlined style={{ fontSize: 10, color: "#94a3b8" }} />
              </span>
            </Dropdown>
          </div>
        </Header>
        <Content className="page">{children}</Content>
      </AntLayout>

      <Modal title="Đổi mật khẩu" open={pwOpen} onOk={changePw} onCancel={() => setPwOpen(false)} okText="Đổi">
        <Form form={form} layout="vertical">
          <Form.Item name="oldPassword" label="Mật khẩu cũ" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  );
}

import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Avatar, Dropdown, Modal, Form, Input, App } from "antd";
import {
  DashboardOutlined, ShoppingCartOutlined, TeamOutlined, BarcodeOutlined,
  ContainerOutlined, DollarOutlined, InboxOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, KeyOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";
import { api } from "../api";

const { Header, Sider, Content } = AntLayout;

const MENU = [
  { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/orders", icon: <ShoppingCartOutlined />, label: "Đơn hàng", perm: "orders.list" },
  { key: "/customers", icon: <TeamOutlined />, label: "Khách hàng", perm: "customers.list" },
  { key: "/tracking", icon: <BarcodeOutlined />, label: "Tracking", perm: "trackings.list" },
  { key: "/warehouse-jp", icon: <InboxOutlined />, label: "Kho Nhật", perm: "warehouse.weigh_jp" },
  { key: "/shipments", icon: <ContainerOutlined />, label: "Chuyến & Chứng từ", perm: "shipments.list" },
  { key: "/accounting", icon: <DollarOutlined />, label: "Kế toán", perm: "accounting.reconcile" },
  { key: "/warehouse", icon: <InboxOutlined />, label: "Kho VN", perm: "warehouse.weigh_vn" },
  { key: "/admin", icon: <SettingOutlined />, label: "Quản trị", perm: "users.list" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const { can } = usePermission();
  const nav = useNavigate();
  const loc = useLocation();
  const { message } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [form] = Form.useForm();

  const items = MENU.filter((m) => !m.perm || can(m.perm)).map((m) => ({ key: m.key, icon: m.icon, label: m.label }));

  async function changePw() {
    const v = await form.validateFields();
    try {
      await api.post("/auth/change-password", v);
      message.success("Đổi mật khẩu thành công, vui lòng đăng nhập lại");
      setPwOpen(false);
      await logout();
    } catch {
      message.error("Mật khẩu cũ không đúng");
    }
  }

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div className="app-logo">{collapsed ? "OHN" : "Order Hàng Nhật"}</div>
        <Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={items} onClick={(e) => nav(e.key)} />
      </Sider>
      <AntLayout>
        <Header className="site-header">
          <span style={{ fontWeight: 600 }}>Hệ thống quản trị order</span>
          <Dropdown menu={{ items: [
            { key: "pw", icon: <KeyOutlined />, label: "Đổi mật khẩu", onClick: () => setPwOpen(true) },
            { key: "out", icon: <LogoutOutlined />, label: "Đăng xuất", onClick: logout },
          ] }}>
            <span style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: "#2563eb", marginRight: 8 }} />
              {me?.fullName ?? me?.email}
            </span>
          </Dropdown>
        </Header>
        <Content className="page">{children}</Content>
      </AntLayout>

      <Modal title="Đổi mật khẩu" open={pwOpen} onOk={changePw} onCancel={() => setPwOpen(false)} okText="Đổi">
        <Form form={form} layout="vertical">
          <Form.Item name="oldPassword" label="Mật khẩu cũ" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  );
}

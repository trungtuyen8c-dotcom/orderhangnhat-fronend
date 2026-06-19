import { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Tag, App } from "antd";
import { PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface User { id: string; email: string; fullName: string | null; isActive: boolean; roles: string[]; }
interface Role { key: string; name: string; }
interface Audit { id: string; actorId: string | null; action: string; createdAt: string; }

export default function Admin() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [assignUser, setAssignUser] = useState<User | null>(null);
  const [cForm] = Form.useForm();
  const [aForm] = Form.useForm();

  const loadUsers = () => api.get<User[]>("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => {
    loadUsers();
    api.get<Role[]>("/admin/roles").then((r) => setRoles(r.data)).catch(() => {});
    if (can("system.view_audit_log")) api.get<Audit[]>("/admin/audit?limit=100").then((r) => setAudit(r.data)).catch(() => {});
  }, []);

  async function createUser() {
    const v = await cForm.validateFields();
    try { await api.post("/admin/users", v); message.success("Đã tạo user"); setOpenCreate(false); cForm.resetFields(); loadUsers(); }
    catch { message.error("Tạo user thất bại (email trùng?)"); }
  }

  function openAssign(u: User) { setAssignUser(u); aForm.setFieldsValue({ roleKeys: u.roles }); }
  async function assign() {
    const v = await aForm.validateFields();
    try { await api.post(`/admin/users/${assignUser!.id}/roles`, v); message.success("Đã gán vai trò"); setAssignUser(null); loadUsers(); }
    catch { message.error("Gán vai trò thất bại"); }
  }

  function exportCsv() {
    const header = "time,actor,action\n";
    const body = audit.map((a) => `${a.createdAt},${a.actorId ?? ""},${a.action}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "audit.csv"; a.click();
  }

  const roleOpts = roles.map((r) => ({ value: r.key, label: r.name }));

  const tabs = [
    {
      key: "users", label: "Người dùng",
      children: (
        <>
          {can("users.create") && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setOpenCreate(true)}>Tạo user</Button>}
          <Table rowKey="id" dataSource={users} size="middle"
            columns={[
              { title: "Email", dataIndex: "email" },
              { title: "Tên", dataIndex: "fullName" },
              { title: "Vai trò", dataIndex: "roles", render: (rs: string[]) => rs.map((r) => <Tag key={r}>{r}</Tag>) },
              { title: "", render: (_, u) => can("roles.assign") && <Button size="small" onClick={() => openAssign(u)}>Gán vai trò</Button> },
            ]} />
        </>
      ),
    },
  ];
  if (can("system.view_audit_log")) tabs.push({
    key: "audit", label: "Audit log",
    children: (
      <>
        <Button icon={<DownloadOutlined />} style={{ marginBottom: 12 }} onClick={exportCsv}>Export CSV</Button>
        <Table rowKey="id" dataSource={audit} size="small"
          columns={[
            { title: "Thời gian", dataIndex: "createdAt", render: (v) => new Date(v).toLocaleString("vi-VN") },
            { title: "Actor", dataIndex: "actorId", render: (v) => v?.slice(0, 8) ?? "-" },
            { title: "Hành động", dataIndex: "action", render: (v) => <Tag color={v.includes("denied") ? "error" : "default"}>{v}</Tag> },
          ]} />
      </>
    ),
  });

  return (
    <Card title="Quản trị">
      <Tabs items={tabs} />

      <Modal title="Tạo user" open={openCreate} onOk={createUser} onCancel={() => setOpenCreate(false)} okText="Tạo">
        <Form form={cForm} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="fullName" label="Tên"><Input /></Form.Item>
          <Form.Item name="roleKeys" label="Vai trò"><Select mode="multiple" options={roleOpts} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Gán vai trò — ${assignUser?.email}`} open={!!assignUser} onOk={assign} onCancel={() => setAssignUser(null)} okText="Lưu">
        <Form form={aForm} layout="vertical">
          <Form.Item name="roleKeys" label="Vai trò"><Select mode="multiple" options={roleOpts} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

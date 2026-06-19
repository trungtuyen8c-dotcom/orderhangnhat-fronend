import { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, Popconfirm, App } from "antd";
import { PlusOutlined, DownloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface User { id: string; email: string; fullName: string | null; isActive: boolean; roles: string[]; }
interface Role { id: number; key: string; name: string; isSystem: boolean; permissions: string[]; }
interface Perm { key: string; resource: string; action: string; }
interface Audit { id: string; actorId: string | null; action: string; createdAt: string; }

export default function Admin() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);

  const [userModal, setUserModal] = useState<{ mode: "create" | "edit"; user?: User } | null>(null);
  const [assignUser, setAssignUser] = useState<User | null>(null);
  const [roleModal, setRoleModal] = useState<{ mode: "create" | "edit"; role?: Role } | null>(null);
  const [uForm] = Form.useForm();
  const [aForm] = Form.useForm();
  const [rForm] = Form.useForm();

  const loadUsers = () => api.get<User[]>("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  const loadRoles = () => api.get<Role[]>("/admin/roles").then((r) => setRoles(r.data)).catch(() => {});
  useEffect(() => {
    loadUsers(); loadRoles();
    if (can("permissions.list")) api.get<Perm[]>("/admin/permissions").then((r) => setPerms(r.data)).catch(() => {});
    if (can("system.view_audit_log")) api.get<Audit[]>("/admin/audit?limit=100").then((r) => setAudit(r.data)).catch(() => {});
  }, []);

  const roleOpts = roles.map((r) => ({ value: r.key, label: r.name }));
  const permOpts = perms.map((p) => ({ value: p.key, label: p.key }));

  // ----- Users -----
  function openUser(mode: "create" | "edit", user?: User) {
    setUserModal({ mode, user });
    if (mode === "edit" && user) uForm.setFieldsValue({ fullName: user.fullName, isActive: user.isActive });
    else uForm.resetFields();
  }
  async function submitUser() {
    const v = await uForm.validateFields();
    try {
      if (userModal!.mode === "create") await api.post("/admin/users", v);
      else await api.patch(`/admin/users/${userModal!.user!.id}`, { fullName: v.fullName, isActive: v.isActive });
      message.success("Đã lưu"); setUserModal(null); loadUsers();
    } catch { message.error("Lưu user thất bại (email trùng?)"); }
  }
  async function deleteUser(id: string) {
    try { await api.delete(`/admin/users/${id}`); message.success("Đã xóa"); loadUsers(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  function openAssign(u: User) { setAssignUser(u); aForm.setFieldsValue({ roleKeys: u.roles }); }
  async function assign() {
    const v = await aForm.validateFields();
    try { await api.post(`/admin/users/${assignUser!.id}/roles`, v); message.success("Đã gán vai trò"); setAssignUser(null); loadUsers(); }
    catch { message.error("Gán vai trò thất bại"); }
  }

  // ----- Roles -----
  function openRole(mode: "create" | "edit", role?: Role) {
    setRoleModal({ mode, role });
    if (mode === "edit" && role) rForm.setFieldsValue({ key: role.key, name: role.name, permissionKeys: role.permissions });
    else rForm.resetFields();
  }
  async function submitRole() {
    const v = await rForm.validateFields();
    try {
      if (roleModal!.mode === "create") await api.post("/admin/roles", v);
      else await api.patch(`/admin/roles/${roleModal!.role!.key}`, { name: v.name, permissionKeys: v.permissionKeys });
      message.success("Đã lưu vai trò"); setRoleModal(null); loadRoles();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Lưu vai trò thất bại"); }
  }
  async function deleteRole(key: string) {
    try { await api.delete(`/admin/roles/${key}`); message.success("Đã xóa vai trò"); loadRoles(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  function exportCsv() {
    const body = "time,actor,action\n" + audit.map((a) => `${a.createdAt},${a.actorId ?? ""},${a.action}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" })); a.download = "audit.csv"; a.click();
  }

  const tabs: any[] = [
    {
      key: "users", label: "Người dùng",
      children: (
        <>
          {can("users.create") && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openUser("create")}>Tạo user</Button>}
          <Table rowKey="id" dataSource={users} size="middle"
            columns={[
              { title: "Email", dataIndex: "email" },
              { title: "Tên", dataIndex: "fullName" },
              { title: "Trạng thái", dataIndex: "isActive", render: (v) => v ? <Tag color="success">Hoạt động</Tag> : <Tag>Khóa</Tag> },
              { title: "Vai trò", dataIndex: "roles", render: (rs: string[]) => rs.map((r) => <Tag key={r}>{r}</Tag>) },
              {
                title: "", width: 220, render: (_, u) => (
                  <Space>
                    {can("roles.assign") && <Button size="small" onClick={() => openAssign(u)}>Vai trò</Button>}
                    {can("users.update") && <Button size="small" icon={<EditOutlined />} onClick={() => openUser("edit", u)} />}
                    {can("users.delete") && <Popconfirm title="Xóa user này?" onConfirm={() => deleteUser(u.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
                  </Space>
                ),
              },
            ]} />
        </>
      ),
    },
    {
      key: "roles", label: "Vai trò",
      children: (
        <>
          {can("roles.create") && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openRole("create")}>Tạo vai trò</Button>}
          <Table rowKey="key" dataSource={roles} size="middle"
            columns={[
              { title: "Key", dataIndex: "key", render: (v) => <code>{v}</code> },
              { title: "Tên", dataIndex: "name" },
              { title: "Loại", dataIndex: "isSystem", render: (v) => v ? <Tag color="gold">Hệ thống</Tag> : <Tag>Tùy chỉnh</Tag> },
              { title: "Số quyền", dataIndex: "permissions", render: (p: string[]) => (p.includes("*") || false) ? "Tất cả" : p.length },
              {
                title: "", width: 140, render: (_, r) => (
                  <Space>
                    {can("roles.update") && r.key !== "super_admin" && <Button size="small" icon={<EditOutlined />} onClick={() => openRole("edit", r)} />}
                    {can("roles.delete") && !r.isSystem && <Popconfirm title="Xóa vai trò này?" onConfirm={() => deleteRole(r.key)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
                  </Space>
                ),
              },
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
            { title: "Hành động", dataIndex: "action", render: (v) => <Tag color={v.includes("denied") ? "error" : v.includes("deleted") ? "warning" : "default"}>{v}</Tag> },
          ]} />
      </>
    ),
  });

  return (
    <PageContainer title="Quản trị" sub="Người dùng, vai trò, phân quyền và nhật ký">
      <Card>
        <Tabs items={tabs} />
      </Card>

      <Modal title={userModal?.mode === "create" ? "Tạo user" : "Sửa user"} open={!!userModal} onOk={submitUser} onCancel={() => setUserModal(null)} okText="Lưu">
        <Form form={uForm} layout="vertical">
          {userModal?.mode === "create" && <>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          </>}
          <Form.Item name="fullName" label="Tên"><Input /></Form.Item>
          {userModal?.mode === "create" && <Form.Item name="roleKeys" label="Vai trò"><Select mode="multiple" options={roleOpts} /></Form.Item>}
          {userModal?.mode === "edit" && <Form.Item name="isActive" label="Hoạt động" valuePropName="checked"><Switch /></Form.Item>}
        </Form>
      </Modal>

      <Modal title={`Gán vai trò — ${assignUser?.email}`} open={!!assignUser} onOk={assign} onCancel={() => setAssignUser(null)} okText="Lưu">
        <Form form={aForm} layout="vertical"><Form.Item name="roleKeys" label="Vai trò"><Select mode="multiple" options={roleOpts} /></Form.Item></Form>
      </Modal>

      <Modal title={roleModal?.mode === "create" ? "Tạo vai trò" : "Sửa vai trò"} open={!!roleModal} onOk={submitRole} onCancel={() => setRoleModal(null)} okText="Lưu" width={560}>
        <Form form={rForm} layout="vertical">
          <Form.Item name="key" label="Key (snake_case)" rules={[{ required: true, pattern: /^[a-z0-9_]+$/, message: "chỉ a-z 0-9 _" }]}>
            <Input disabled={roleModal?.mode === "edit"} placeholder="vd: warehouse_lead" />
          </Form.Item>
          <Form.Item name="name" label="Tên hiển thị" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="permissionKeys" label="Quyền">
            <Select mode="multiple" allowClear options={permOpts} placeholder="Chọn quyền" maxTagCount="responsive" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

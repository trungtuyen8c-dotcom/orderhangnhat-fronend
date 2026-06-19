import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Space, Popconfirm, App } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface Customer { id: string; name: string; fbZalo?: string | null; phone?: string | null; note?: string | null; }

export default function Customers() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<{ mode: "create" | "edit"; row?: Customer } | null>(null);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); api.get<Customer[]>("/customers").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  function open(mode: "create" | "edit", row?: Customer) {
    setEdit({ mode, row });
    if (mode === "edit" && row) form.setFieldsValue(row); else form.resetFields();
  }
  async function submit() {
    const v = await form.validateFields();
    try {
      if (edit!.mode === "create") await api.post("/customers", v);
      else await api.patch(`/customers/${edit!.row!.id}`, v);
      message.success("Đã lưu"); setEdit(null); load();
    } catch { message.error("Lưu khách thất bại"); }
  }
  async function del(id: string) {
    try { await api.delete(`/customers/${id}`); message.success("Đã xóa"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  return (
    <PageContainer
      title="Khách hàng" sub="Quản lý khách đặt hàng"
      extra={can("customers.create") && <Button type="primary" icon={<PlusOutlined />} onClick={() => open("create")}>Thêm khách</Button>}
    >
      <Card>
        <Table
          rowKey="id" loading={loading} dataSource={rows} size="middle"
          columns={[
            { title: "Tên", dataIndex: "name" },
            { title: "FB/Zalo", dataIndex: "fbZalo" },
            { title: "SĐT", dataIndex: "phone" },
            { title: "Ghi chú", dataIndex: "note" },
            {
              title: "", width: 110, render: (_, r) => (
                <Space>
                  {can("customers.update") && <Button size="small" icon={<EditOutlined />} onClick={() => open("edit", r)} />}
                  {can("customers.delete") && <Popconfirm title="Xóa khách này?" onConfirm={() => del(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
                </Space>
              ),
            },
          ]}
        />
        <Modal title={edit?.mode === "create" ? "Thêm khách" : "Sửa khách"} open={!!edit} onOk={submit} onCancel={() => setEdit(null)} okText="Lưu">
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="fbZalo" label="FB/Zalo"><Input /></Form.Item>
            <Form.Item name="phone" label="SĐT"><Input /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  );
}

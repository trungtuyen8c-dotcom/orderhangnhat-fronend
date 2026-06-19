import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface Customer { id: string; name: string; fbZalo?: string | null; phone?: string | null; note?: string | null; }

export default function Customers() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); api.get<Customer[]>("/customers").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  async function submit() {
    const v = await form.validateFields();
    try { await api.post("/customers", v); message.success("Đã thêm khách"); setOpen(false); form.resetFields(); load(); }
    catch { message.error("Tạo khách thất bại"); }
  }

  return (
    <PageContainer
      title="Khách hàng" sub="Quản lý khách đặt hàng"
      extra={can("customers.create") && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Thêm khách</Button>}
    >
      <Card>
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Tên", dataIndex: "name" },
          { title: "FB/Zalo", dataIndex: "fbZalo" },
          { title: "SĐT", dataIndex: "phone" },
          { title: "Ghi chú", dataIndex: "note" },
        ]}
      />
      <Modal title="Thêm khách" open={open} onOk={submit} onCancel={() => setOpen(false)} okText="Lưu">
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

import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tag, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface T { id: string; code: string; orderId: string | null; jpName: string | null; jpWeightKg: string | null; status: string; }
interface Order { id: string; code: string; }

export default function Tracking() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolveT, setResolveT] = useState<T | null>(null);
  const [form] = Form.useForm();
  const [rForm] = Form.useForm();

  const load = () => { setLoading(true); api.get<T[]>("/trackings").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    if (can("orders.list")) api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
  }, []);

  async function create() {
    const v = await form.validateFields();
    try { await api.post("/trackings", v); message.success("Đã thêm tracking"); setOpen(false); form.resetFields(); load(); }
    catch { message.error("Tạo tracking thất bại"); }
  }

  async function resolve() {
    const v = await rForm.validateFields();
    try { await api.post(`/trackings/${resolveT!.id}/resolve`, v); message.success("Đã xử lý"); setResolveT(null); rForm.resetFields(); load(); }
    catch { message.error("Xử lý thất bại"); }
  }

  return (
    <Card title="Tracking" extra={can("trackings.create") && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Thêm tracking</Button>}>
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Mã", dataIndex: "code" },
          { title: "Đơn", dataIndex: "orderId", render: (v) => (v ? <Tag color="blue">đã gán</Tag> : <Tag>chưa</Tag>) },
          { title: "Tên JP", dataIndex: "jpName" },
          { title: "Cân (kg)", dataIndex: "jpWeightKg" },
          { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag>{v}</Tag> },
          { title: "", render: (_, t) => can("trackings.resolve") && <Button size="small" onClick={() => setResolveT(t)}>Xử lý lạ</Button> },
        ]}
      />

      <Modal title="Thêm tracking" open={open} onOk={create} onCancel={() => setOpen(false)} okText="Lưu">
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Mã tracking" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="orderId" label="Gán đơn (tùy chọn)">
            <Select allowClear showSearch optionFilterProp="label" options={orders.map((o) => ({ value: o.id, label: o.code }))} />
          </Form.Item>
          <Form.Item name="jpName" label="Tên (JP)"><Input /></Form.Item>
          <Form.Item name="jpPriceJpy" label="Giá ¥"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Xử lý tracking lạ" open={!!resolveT} onOk={resolve} onCancel={() => setResolveT(null)} okText="Lưu">
        <Form form={rForm} layout="vertical">
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="orderId" label="Gán lại đơn (tùy chọn)">
            <Select allowClear showSearch optionFilterProp="label" options={orders.map((o) => ({ value: o.id, label: o.code }))} />
          </Form.Item>
          <Form.Item name="code" label="Sửa mã (tùy chọn)"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

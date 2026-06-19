import { useEffect, useState } from "react";
import { Card, Table, Form, Select, InputNumber, Input, Button, Tag, App } from "antd";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";

interface Order { id: string; code: string; }
interface Recon { id: string; orderId: string; jpWeight: string | null; vnWeight: string | null; diffKg: string | null; note: string | null; }

export default function Warehouse() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [rows, setRows] = useState<Recon[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); api.get<Recon[]>("/warehouse/recon").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    load();
  }, []);

  async function submit() {
    const v = await form.validateFields();
    try { await api.post("/warehouse/vn-weight", v); message.success("Đã ghi cân + đối soát"); form.resetFields(); load(); }
    catch { message.error("Ghi cân thất bại"); }
  }

  return (
    <PageContainer title="Kho VN" sub="Cân thực tế và đối soát chênh cân">
      <Card>
      <Form form={form} layout="inline" onFinish={submit} style={{ marginBottom: 16 }}>
        <Form.Item name="orderId" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" placeholder="Chọn đơn" style={{ width: 200 }} options={orders.map((o) => ({ value: o.id, label: o.code }))} />
        </Form.Item>
        <Form.Item name="vnWeight" rules={[{ required: true }]}>
          <InputNumber min={0} step={0.001} placeholder="Cân VN (kg)" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="note"><Input placeholder="Ghi chú" /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit">Ghi cân</Button></Form.Item>
      </Form>
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Đơn", dataIndex: "orderId", render: (v) => v.slice(0, 8) },
          { title: "Cân JP", dataIndex: "jpWeight" },
          { title: "Cân VN", dataIndex: "vnWeight" },
          { title: "Chênh (kg)", dataIndex: "diffKg", render: (v) => (Number(v) !== 0 ? <Tag color="error">{v}</Tag> : <Tag color="success">{v}</Tag>) },
          { title: "Ghi chú", dataIndex: "note" },
        ]}
      />
      </Card>
    </PageContainer>
  );
}

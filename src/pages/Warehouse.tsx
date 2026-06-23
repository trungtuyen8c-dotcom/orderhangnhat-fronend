import { useEffect, useState } from "react";
import { Card, Table, Form, Select, InputNumber, Input, Button, Tag, App } from "antd";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";

interface Order { id: string; code: string; }
interface Trk { id: string; code: string; vnTrackingCode: string | null; }
interface Recon { id: string; orderId: string; jpWeight: string | null; vnWeight: string | null; diffKg: string | null; note: string | null; }

export default function Warehouse() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [trks, setTrks] = useState<Trk[]>([]);
  const [rows, setRows] = useState<Recon[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [vForm] = Form.useForm();

  const load = () => { setLoading(true); api.get<Recon[]>("/warehouse/recon").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  const loadTrks = () => api.get<Trk[]>("/trackings").then((r) => setTrks(r.data)).catch(() => {});
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    loadTrks(); load();
  }, []);

  async function submit() {
    const v = await form.validateFields();
    try { await api.post("/warehouse/vn-weight", v); message.success("Đã ghi cân + đối soát"); form.resetFields(); load(); }
    catch { message.error("Ghi cân thất bại"); }
  }

  async function submitVnTrack() {
    const v = await vForm.validateFields();
    try { await api.post("/warehouse/vn-tracking", v); message.success("Đã lưu tracking VN"); vForm.resetFields(); loadTrks(); }
    catch { message.error("Lưu tracking VN thất bại"); }
  }

  return (
    <PageContainer title="Kho VN" sub="Cân thực tế, đối soát chênh cân và nhập tracking nội địa VN">
      <Card title="Nhập tracking nội địa VN (hàng về kho VN)" style={{ marginBottom: 16 }}>
        <Form form={vForm} layout="inline" onFinish={submitVnTrack}>
          <Form.Item name="trackingId" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn mã tracking (JP)" style={{ width: 240 }}
              options={trks.map((t) => ({ value: t.id, label: t.code + (t.vnTrackingCode ? ` (VN: ${t.vnTrackingCode})` : "") }))} />
          </Form.Item>
          <Form.Item name="vnTrackingCode" rules={[{ required: true }]}>
            <Input placeholder="Mã tracking VN" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Lưu</Button></Form.Item>
        </Form>
      </Card>
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

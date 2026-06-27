import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Button, Form, Input, InputNumber, Space, Tag, Popconfirm, Modal, App } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Carton { id: string; code: string; note: string | null; declaredWeightKg: number | null; actualKg: number; count: number; diffKg: number | null; trackings: { id: string; code: string; jpWeightKg: string | null; vnWeightKg: string | null; order?: { code: string } | null }[]; }
interface Unmatched { id: string; code: string; vnTrackingCode: string | null; jpWeightKg: string | null; vnWeightKg: string | null; packedAt: string | null; review: string | null; }
interface Overdue { customerId: string; name: string; code: string | null; phone: string | null; balance: number; days: number; }

const kg = (v: any) => (v != null ? Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "-");

export default function Control() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [ov, setOv] = useState<any>(null);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [cfg, setCfg] = useState<{ thresholdVnd: number; overdueDays: number }>({ thresholdVnd: 0, overdueDays: 30 });
  const [cForm] = Form.useForm();
  const [cfgForm] = Form.useForm();
  const [assignFor, setAssignFor] = useState<Carton | null>(null);
  const [assignText, setAssignText] = useState("");

  const loadOv = () => api.get("/control/overview").then((r) => setOv(r.data)).catch(() => {});
  const loadCartons = () => api.get<Carton[]>("/control/cartons").then((r) => setCartons(r.data)).catch(() => {});
  const loadUnmatched = () => api.get<Unmatched[]>("/control/unmatched").then((r) => setUnmatched(r.data)).catch(() => {});
  const loadOverdue = () => api.get<{ cfg: any; list: Overdue[] }>("/control/overdue-debts").then((r) => { setOverdue(r.data.list); setCfg(r.data.cfg); cfgForm.setFieldsValue(r.data.cfg); }).catch(() => {});
  useEffect(() => { loadOv(); loadCartons(); loadUnmatched(); loadOverdue(); }, []);

  async function createCarton() {
    const v = await cForm.validateFields();
    try { await api.post("/control/cartons", v); message.success("Đã tạo kiện"); cForm.resetFields(); loadCartons(); loadOv(); }
    catch { message.error("Tạo kiện thất bại"); }
  }
  async function delCarton(id: string) {
    try { await api.delete(`/control/cartons/${id}`); message.success("Đã xóa kiện"); loadCartons(); loadOv(); }
    catch { message.error("Xóa thất bại"); }
  }
  async function unassign(trackingId: string) {
    try { await api.patch(`/trackings/${trackingId}`, { cartonId: null }); loadCartons(); loadOv(); }
    catch { message.error("Bỏ khỏi kiện thất bại"); }
  }
  async function doAssign() {
    const codes = assignText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!codes.length) return message.error("Dán ít nhất 1 mã tracking");
    try { const r = await api.post<{ assigned: number }>(`/control/cartons/${assignFor!.id}/assign`, { codes }); message.success(`Đã gán ${r.data.assigned} tracking`); setAssignFor(null); setAssignText(""); loadCartons(); loadOv(); }
    catch { message.error("Gán thất bại"); }
  }
  async function saveCfg() {
    const v = await cfgForm.validateFields();
    try { await api.put("/control/debt-config", v); message.success("Đã lưu ngưỡng"); loadOverdue(); loadOv(); }
    catch { message.error("Lưu thất bại"); }
  }

  const cards = [
    { label: "Đơn >7 ngày chưa tracking", v: ov?.lateOrders, color: "#dc2626" },
    { label: "Chưa đánh giá", v: ov?.notReviewed, color: "#ea7a17" },
    { label: "Cọc chờ xác nhận", v: ov?.pendingDeposits, color: "#ea7a17" },
    { label: "Chưa chụp chứng từ", v: ov?.docNotCaptured, color: "#ea7a17" },
    { label: "Tracking chưa khớp đơn", v: ov?.unmatched, color: "#dc2626" },
    { label: "Đơn thiếu giá/tỉ giá", v: ov?.missingPrice, color: "#dc2626" },
    { label: "Kiện lệch cân", v: ov?.cartonMismatch, color: "#dc2626" },
    { label: "Công nợ quá hạn", v: ov?.overdueDebts, color: "#dc2626" },
  ];

  return (
    <PageContainer title="Trung tâm kiểm soát" sub="Cảnh báo cần xử lý, đối soát cân kiện, công nợ quá hạn">
      <Row gutter={[16, 16]} className="stat-cards" style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <Col xs={12} md={6} key={c.label}>
            <Card size="small"><Statistic title={c.label} value={c.v ?? 0} valueStyle={{ color: (c.v ?? 0) > 0 ? c.color : "#16a34a" }} /></Card>
          </Col>
        ))}
      </Row>

      <Card title="Kiện & đối soát cân (kho Nhật báo cân tổng)" style={{ marginBottom: 16 }}>
        {can("trackings.update") && (
          <Form form={cForm} layout="inline" style={{ marginBottom: 12 }} onFinish={createCarton}>
            <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="Mã kiện (vd A1)" /></Form.Item>
            <Form.Item name="declaredWeightKg"><InputNumber min={0} step={0.1} placeholder="Cân tổng kho Nhật (kg)" style={{ width: 200 }} /></Form.Item>
            <Form.Item name="note"><Input placeholder="Ghi chú" /></Form.Item>
            <Form.Item><Button type="primary" icon={<PlusOutlined />} htmlType="submit">Tạo kiện</Button></Form.Item>
          </Form>
        )}
        <Table rowKey="id" size="small" dataSource={cartons} pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Chưa có kiện" }}
          expandable={{ expandedRowRender: (c) => (
            <Table rowKey="id" size="small" pagination={false} dataSource={c.trackings}
              locale={{ emptyText: "Kiện trống" }}
              columns={[
                { title: "Mã tracking", dataIndex: "code" },
                { title: "Đơn", dataIndex: ["order", "code"], render: (v) => v ?? "-" },
                { title: "Cân lẻ (kg)", render: (_, t) => kg(t.vnWeightKg ?? t.jpWeightKg) },
                ...(can("trackings.update") ? [{ title: "", width: 60, render: (_: any, t: any) => (<Button size="small" danger onClick={() => unassign(t.id)}>Bỏ</Button>) }] : []),
              ]} />
          ) }}
          columns={[
            { title: "Mã kiện", dataIndex: "code" },
            { title: "Số tracking", dataIndex: "count", align: "right" },
            { title: "Cân kho Nhật", dataIndex: "declaredWeightKg", align: "right", render: (v) => kg(v) },
            { title: "Cân lẻ cộng lại", dataIndex: "actualKg", align: "right", render: (v) => kg(v) },
            { title: "Chênh lệch", dataIndex: "diffKg", align: "right", render: (v) => {
              if (v == null) return <Tag>chưa có cân tổng</Tag>;
              const ok = Math.abs(v) <= 0.1;
              return <b style={{ color: ok ? "#16a34a" : "#dc2626" }}>{v > 0 ? "+" : ""}{kg(v)} kg</b>;
            } },
            { title: "Ghi chú", dataIndex: "note", render: (v) => v ?? "-" },
            ...(can("trackings.update") ? [{ title: "", width: 150, render: (_: any, c: Carton) => (
              <Space>
                <Button size="small" onClick={() => { setAssignFor(c); setAssignText(""); }}>Gán mã</Button>
                <Popconfirm title="Xóa kiện?" onConfirm={() => delCarton(c.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
              </Space>
            ) }] : []),
          ]} />
      </Card>

      <Card title={`Tracking về VN chưa khớp đơn (${unmatched.length})`} style={{ marginBottom: 16 }}
        extra={<span style={{ color: "#666" }}>Hàng đã về nhưng mã tracking chưa gắn đơn nào - cần xử lý ở trang Vận chuyển</span>}>
        <Table rowKey="id" size="small" dataSource={unmatched} pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Không có tracking lạc" }}
          columns={[
            { title: "Mã tracking", dataIndex: "code", render: (v) => v || "(trống)" },
            { title: "Mã VN", dataIndex: "vnTrackingCode", render: (v) => v ?? "-" },
            { title: "Cân (kg)", render: (_, t) => kg(t.vnWeightKg ?? t.jpWeightKg) },
            { title: "Đóng về", dataIndex: "packedAt", render: (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "-") },
            { title: "Ghi chú", dataIndex: "review", render: (v) => v ?? "-" },
          ]} />
      </Card>

      <Card title={`Công nợ quá hạn / vượt ngưỡng (${overdue.length})`}
        extra={can("system.manage_settings") && (
          <Form form={cfgForm} layout="inline" initialValues={cfg} onFinish={saveCfg}>
            <Form.Item name="thresholdVnd" label="Ngưỡng nợ (₫)"><InputNumber min={0} step={1000000} style={{ width: 160 }} /></Form.Item>
            <Form.Item name="overdueDays" label="Số ngày"><InputNumber min={0} style={{ width: 90 }} /></Form.Item>
            <Form.Item><Button htmlType="submit">Lưu</Button></Form.Item>
          </Form>
        )}>
        <Table rowKey="customerId" size="small" dataSource={overdue} pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Không có công nợ quá hạn" }}
          columns={[
            { title: "Khách", dataIndex: "name", render: (v, r) => `${v}${r.code ? ` (${r.code})` : ""}` },
            { title: "SĐT", dataIndex: "phone", render: (v) => v ?? "-" },
            { title: "Còn nợ", dataIndex: "balance", align: "right", render: (v) => <b style={{ color: "#dc2626" }}>{vnd(v)}</b> },
            { title: "Đơn cũ nhất (ngày)", dataIndex: "days", align: "right", render: (v) => `${v} ngày` },
          ]} />
      </Card>

      <Modal title={`Gán mã tracking vào kiện ${assignFor?.code ?? ""}`} open={!!assignFor} onOk={doAssign} onCancel={() => setAssignFor(null)} okText="Gán">
        <p style={{ marginTop: 0, color: "#666" }}>Dán mã tracking, mỗi dòng 1 mã. Mã trùng tracking trong hệ thống sẽ được gắn vào kiện này.</p>
        <Input.TextArea rows={8} value={assignText} onChange={(e) => setAssignText(e.target.value)} placeholder={"368149895794\n507712345678"} style={{ fontFamily: "monospace" }} />
      </Modal>
    </PageContainer>
  );
}

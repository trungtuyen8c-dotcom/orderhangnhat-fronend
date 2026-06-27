import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Button, Form, InputNumber, Select, Input, DatePicker, Tag, Popconfirm, App, Alert } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Row { id: string; name: string; month: string; amountVnd: string; note: string | null; paid: boolean; }
interface U { id: string; name: string; email: string; }

export default function Payroll() {
  const { hasRole } = usePermission();
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [data, setData] = useState<{ rows: Row[]; totalVnd: number; paidVnd: number; unpaidVnd: number } | null>(null);
  const [users, setUsers] = useState<U[]>([]);
  const [form] = Form.useForm();

  const load = (m: Dayjs) => api.get("/payroll", { params: { month: m.format("YYYY-MM") } }).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { if (hasRole("super_admin")) { load(month); api.get<U[]>("/payroll/users").then((r) => setUsers(r.data)).catch(() => {}); } }, []);

  if (!hasRole("super_admin")) return <PageContainer title="Lương"><Alert type="error" message="Chỉ super admin được xem mục này" /></PageContainer>;

  async function add() {
    const v = await form.validateFields();
    const u = users.find((x) => x.id === v.userId);
    try {
      await api.post("/payroll", { userId: v.userId, name: u?.name ?? v.name, month: month.format("YYYY-MM"), amountVnd: v.amountVnd, note: v.note });
      message.success("Đã thêm"); form.resetFields(); load(month);
    } catch { message.error("Thêm thất bại"); }
  }
  async function togglePaid(id: string) { try { await api.patch(`/payroll/${id}/paid`); load(month); } catch { message.error("Lỗi"); } }
  async function del(id: string) { try { await api.delete(`/payroll/${id}`); load(month); } catch { message.error("Lỗi"); } }

  return (
    <PageContainer title="Lương nhân viên" sub="Chỉ super admin xem được"
      extra={<DatePicker picker="month" value={month} format="MM/YYYY" allowClear={false} onChange={(m) => { if (m) { setMonth(m); load(m); } }} />}>
      <Row gutter={[16, 16]} className="stat-cards" style={{ marginBottom: 16 }}>
        <Col xs={8}><Card size="small"><Statistic title="Tổng lương tháng" value={data?.totalVnd ?? 0} suffix="₫" /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Đã trả" value={data?.paidVnd ?? 0} suffix="₫" valueStyle={{ color: "#16a34a" }} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Chưa trả" value={data?.unpaidVnd ?? 0} suffix="₫" valueStyle={{ color: "#dc2626" }} /></Card></Col>
      </Row>

      <Card title="Bảng lương">
        <Form form={form} layout="inline" style={{ marginBottom: 12, rowGap: 8, flexWrap: "wrap" }} onFinish={add}>
          <Form.Item name="userId"><Select allowClear showSearch optionFilterProp="label" placeholder="Chọn NV" style={{ width: 180 }}
            options={users.map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
          <Form.Item name="name"><Input placeholder="Hoặc gõ tên" style={{ width: 140 }} /></Form.Item>
          <Form.Item name="amountVnd" rules={[{ required: true, message: "Nhập lương" }]}>
            <InputNumber min={0} step={1000000} placeholder="Lương ₫" style={{ width: 140 }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={(v) => Number((v ?? "").replace(/,/g, "")) as any} /></Form.Item>
          <Form.Item name="note"><Input placeholder="Ghi chú" style={{ width: 160 }} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Thêm</Button></Form.Item>
        </Form>
        <Table rowKey="id" size="small" dataSource={data?.rows ?? []} pagination={{ pageSize: 20 }}
          locale={{ emptyText: "Chưa có bảng lương" }}
          columns={[
            { title: "Nhân viên", dataIndex: "name" },
            { title: "Tháng", dataIndex: "month" },
            { title: "Lương", dataIndex: "amountVnd", align: "right", render: (v) => vnd(Number(v)) },
            { title: "Ghi chú", dataIndex: "note", render: (v) => v ?? "-" },
            { title: "Trạng thái", dataIndex: "paid", render: (v, r) => (
              <Tag color={v ? "green" : "orange"} style={{ cursor: "pointer" }} onClick={() => togglePaid(r.id)}>{v ? "Đã trả" : "Chưa trả"}</Tag>
            ) },
            { title: "", width: 50, render: (_, r) => (
              <Popconfirm title="Xóa?" onConfirm={() => del(r.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
            ) },
          ]} />
      </Card>
    </PageContainer>
  );
}

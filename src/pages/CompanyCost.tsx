import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Button, Form, InputNumber, Select, Input, DatePicker, Tag, Popconfirm, App } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Entry { id: string; kind: string; kindLabel: string; amountVnd: number; currency: string; amountOrig: number; exchangeRate: number | null; note: string | null; paid: boolean; }
interface Report { month: string; reinforceCount: number; reinforceUnit: number; reinforceVnd: number; entries: Entry[]; byKind: Record<string, number>; totalVnd: number; paidVnd: number; unpaidVnd: number; }

export default function CompanyCost() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [rep, setRep] = useState<Report | null>(null);
  const [cur, setCur] = useState<"VND" | "JPY">("JPY");
  const [form] = Form.useForm();
  const [priceForm] = Form.useForm();

  const load = (m: Dayjs) => api.get<Report>("/company-costs/report", { params: { month: m.format("YYYY-MM") } }).then((r) => { setRep(r.data); priceForm.setFieldsValue({ unit: r.data.reinforceUnit }); }).catch(() => {});
  useEffect(() => { load(month); }, []);

  async function addEntry() {
    const v = await form.validateFields();
    try {
      await api.post("/company-costs", { kind: v.kind, month: month.format("YYYY-MM"), amount: v.amount, currency: v.currency, exchangeRate: v.exchangeRate, note: v.note });
      message.success("Đã thêm khoản phải trả"); form.resetFields(); setCur("JPY"); load(month);
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Thêm thất bại"); }
  }
  async function togglePaid(id: string) { try { await api.patch(`/company-costs/${id}/paid`); load(month); } catch { message.error("Lỗi"); } }
  async function delEntry(id: string) { try { await api.delete(`/company-costs/${id}`); load(month); } catch { message.error("Lỗi"); } }
  async function savePrice() { const v = await priceForm.validateFields(); try { await api.put("/company-costs/reinforce-price", { unit: v.unit }); message.success("Đã lưu đơn giá gia cố"); load(month); } catch { message.error("Lỗi"); } }

  return (
    <PageContainer title="Phải trả kho / công ty" sub="着払い, gia cố/kiểm tra, tiền cân theo tháng"
      extra={<DatePicker picker="month" value={month} format="MM/YYYY" allowClear={false} onChange={(m) => { if (m) { setMonth(m); load(m); } }} />}>
      <Row gutter={[16, 16]} className="stat-cards" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Tổng phải trả" value={rep?.totalVnd ?? 0} suffix="₫" valueStyle={{ color: "#dc2626" }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Đã trả" value={rep?.paidVnd ?? 0} suffix="₫" valueStyle={{ color: "#16a34a" }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Còn phải trả" value={rep?.unpaidVnd ?? 0} suffix="₫" valueStyle={{ color: "#ea7a17" }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={`Gia cố (${rep?.reinforceCount ?? 0} đơn)`} value={rep?.reinforceVnd ?? 0} suffix="₫" /></Card></Col>
      </Row>

      <Card title="Phí gia cố / kiểm tra (tự tính từ đơn cần gia cố)" style={{ marginBottom: 16 }}
        extra={can("system.manage_settings") && (
          <Form form={priceForm} layout="inline" onFinish={savePrice}>
            <Form.Item name="unit" label="Đơn giá/đơn"><InputNumber min={0} step={1000} style={{ width: 120 }} /></Form.Item>
            <Form.Item><Button htmlType="submit">Lưu</Button></Form.Item>
          </Form>
        )}>
        <p style={{ margin: 0 }}>Tháng này có <b>{rep?.reinforceCount ?? 0}</b> đơn cần gia cố/kiểm tra × {vnd(rep?.reinforceUnit ?? 0)} = <b style={{ color: "#dc2626" }}>{vnd(rep?.reinforceVnd ?? 0)}</b></p>
      </Card>

      <Card title="Khoản nhập tay (着払い / tiền cân / khác)"
        extra={can("accounting.record_payment") && (
          <Form form={form} layout="inline" initialValues={{ kind: "chakubarai", currency: "JPY" }} onFinish={addEntry}>
            <Form.Item name="kind"><Select style={{ width: 150 }} options={[{ value: "chakubarai", label: "着払い" }, { value: "weight", label: "Tiền cân tháng" }, { value: "other", label: "Khác" }]} /></Form.Item>
            <Form.Item name="amount" rules={[{ required: true }]}><InputNumber min={0} placeholder="Số tiền" style={{ width: 120 }} /></Form.Item>
            <Form.Item name="currency"><Select style={{ width: 80 }} onChange={(v) => setCur(v)} options={[{ value: "VND", label: "VND" }, { value: "JPY", label: "JPY" }]} /></Form.Item>
            {cur === "JPY" && <Form.Item name="exchangeRate" rules={[{ required: true }]}><InputNumber min={0} placeholder="Tỉ giá" style={{ width: 100 }} /></Form.Item>}
            <Form.Item name="note"><Input placeholder="Ghi chú" style={{ width: 150 }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit">Thêm</Button></Form.Item>
          </Form>
        )}>
        <Table rowKey="id" size="small" dataSource={rep?.entries ?? []} pagination={{ pageSize: 15 }}
          locale={{ emptyText: "Chưa có khoản nào" }}
          columns={[
            { title: "Loại", dataIndex: "kindLabel" },
            { title: "Số tiền", dataIndex: "amountVnd", align: "right", render: (v, e) => (
              <span>{vnd(v)}{e.currency === "JPY" ? <span style={{ color: "#888", fontSize: 12 }}> ({Number(e.amountOrig).toLocaleString("ja-JP")}¥)</span> : null}</span>
            ) },
            { title: "Ghi chú", dataIndex: "note", render: (v) => v ?? "-" },
            { title: "Trạng thái", dataIndex: "paid", render: (v, e) => (
              <Tag color={v ? "green" : "orange"} style={{ cursor: "pointer" }} onClick={() => togglePaid(e.id)}>{v ? "Đã trả" : "Chưa trả"}</Tag>
            ) },
            ...(can("accounting.record_payment") ? [{ title: "", width: 50, render: (_: any, e: Entry) => (
              <Popconfirm title="Xóa khoản này?" onConfirm={() => delEntry(e.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
            ) }] : []),
          ]} />
      </Card>
    </PageContainer>
  );
}

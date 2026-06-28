import { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Space, Popconfirm, App, Drawer, InputNumber, DatePicker, Select, Statistic, Divider } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, WalletOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Customer { id: string; code?: string | null; name: string; fbZalo?: string | null; phone?: string | null; address?: string | null; note?: string | null; sheetId?: string | null; shipRatePerKg?: number | string | null; revenue?: number; debt?: number; }
interface Wallet { id: string; name: string; currency: string; }
interface Deposit { id: string; amountVnd: string; currency?: string; amountOrig?: string; payerName?: string | null; method?: string | null; note?: string | null; paidAt: string; confirmed: boolean; }
interface MonthRow { month: string; order: number; paid: number; balance: number; }
interface Ledger { orderTotal: number; depositTotal: number; pendingTotal: number; paymentTotal: number; paidTotal: number; debt: number; deposits: Deposit[]; byMonth: MonthRow[]; }

export default function Customers() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<{ mode: "create" | "edit"; row?: Customer } | null>(null);
  const [form] = Form.useForm();
  const [ledgerCus, setLedgerCus] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [depForm] = Form.useForm();
  const [depCur, setDepCur] = useState<"VND" | "JPY">("VND");

  const load = () => { setLoading(true); api.get<Customer[]>("/customers").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    api.get<Wallet[]>("/accounting/wallets").then((r) => setWallets(r.data.filter((w) => w.currency === "VND"))).catch(() => {});
  }, []);

  function openLedger(c: Customer) {
    setLedgerCus(c); setLedger(null); depForm.resetFields();
    api.get<Ledger>(`/accounting/customers/${c.id}/ledger`).then((r) => setLedger(r.data)).catch(() => message.error("Không tải được công nợ"));
  }
  const reloadLedger = () => ledgerCus && api.get<Ledger>(`/accounting/customers/${ledgerCus.id}/ledger`).then((r) => setLedger(r.data));
  async function addDeposit() {
    const v = await depForm.validateFields();
    try {
      await api.post(`/accounting/customers/${ledgerCus!.id}/deposits`, { amount: v.amount, currency: v.currency, exchangeRate: v.exchangeRate, payerName: v.payerName, method: v.method, walletId: v.walletId, note: v.note, paidAt: v.paidAt?.toISOString() });
      message.success("Đã ghi cọc, đã đẩy lên sheet khách"); depForm.resetFields(); setDepCur("VND"); reloadLedger(); load();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Ghi cọc thất bại"); }
  }
  async function delDeposit(id: string) {
    try { await api.delete(`/accounting/customer-deposits/${id}`); message.success("Đã xóa"); reloadLedger(); load(); }
    catch { message.error("Xóa thất bại"); }
  }
  async function toggleConfirm(d: Deposit) {
    try { await api.post(`/accounting/customer-deposits/${d.id}/${d.confirmed ? "unconfirm" : "confirm"}`); reloadLedger(); load(); }
    catch { message.error("Không đổi được trạng thái"); }
  }

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((c) => [c.name, c.phone, c.code, c.fbZalo].some((x) => (x ?? "").toLowerCase().includes(kw)));
  }, [rows, q]);

  function open(mode: "create" | "edit", row?: Customer) {
    setEdit({ mode, row });
    if (mode === "edit" && row) form.setFieldsValue({ ...row, sheetUrl: row.sheetId ?? undefined, shipRatePerKg: row.shipRatePerKg != null ? Number(row.shipRatePerKg) : undefined }); else form.resetFields();
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
        <Input.Search allowClear placeholder="Tìm tên / SĐT / mã KH / FB-Zalo" style={{ width: 320, marginBottom: 16 }}
          value={q} onChange={(e) => setQ(e.target.value)} />
        <Table
          rowKey="id" loading={loading} dataSource={shown} size="middle"
          columns={[
            { title: "Mã KH", dataIndex: "code", width: 90, render: (v) => v ?? "-" },
            { title: "Tên", dataIndex: "name" },
            { title: "SĐT", dataIndex: "phone" },
            { title: "FB/Zalo", dataIndex: "fbZalo" },
            { title: "Địa chỉ", dataIndex: "address", ellipsis: true },
            { title: "Doanh số", dataIndex: "revenue", align: "right", render: (v) => vnd(v) },
            { title: "Công nợ", dataIndex: "debt", align: "right", render: (v) => (Number(v) ? <b style={{ color: "#dc2626" }}>{vnd(v)}</b> : vnd(v)) },
            { title: "Sheet", dataIndex: "sheetId", width: 70, align: "center", render: (v) => (v ? "✓" : "-") },
            {
              title: "", width: 150, render: (_, r) => (
                <Space>
                  <Button size="small" icon={<WalletOutlined />} onClick={() => openLedger(r)}>Ví</Button>
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
            <Form.Item name="phone" label="SĐT"><Input /></Form.Item>
            <Form.Item name="fbZalo" label="FB/Zalo"><Input /></Form.Item>
            <Form.Item name="address" label="Địa chỉ nhận hàng"><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="sheetUrl" label="Link Google Sheet riêng (share cho service account)"
              extra="Dán link file Sheet của khách (1 khách 1 file). Đơn tự điền vào tab tháng (số '7','8'...) - giữ nguyên template/màu/công thức của bạn.">
              <Input placeholder="https://docs.google.com/spreadsheets/d/..." />
            </Form.Item>
            <Form.Item name="shipRatePerKg" label="Đơn giá ship (đ/kg) - kho cân xong tự tính, kho không thấy"><InputNumber min={0} step={1000} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={(v) => Number((v ?? "").replace(/,/g, "")) as any} /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          </Form>
        </Modal>
      </Card>

      <Drawer width={560} open={!!ledgerCus} onClose={() => setLedgerCus(null)}
        title={`Ví / Công nợ — ${ledgerCus?.name ?? ""}${ledgerCus?.code ? ` (${ledgerCus.code})` : ""}`}>
        {ledger && (
          <>
            <Space size="large" wrap>
              <Statistic title="Tổng đơn" value={ledger.orderTotal} formatter={(v) => vnd(Number(v))} />
              <Statistic title="Đã nạp/trả" value={ledger.paidTotal} formatter={(v) => vnd(Number(v))} valueStyle={{ color: "#16a34a" }} />
              <Statistic title="Cọc chờ xác nhận" value={ledger.pendingTotal} formatter={(v) => vnd(Number(v))} valueStyle={{ color: "#ea7a17" }} />
              <Statistic title={ledger.debt > 0 ? "Còn nợ" : "Dư cọc"} value={Math.abs(ledger.debt)} formatter={(v) => vnd(Number(v))}
                valueStyle={{ color: ledger.debt > 0 ? "#dc2626" : "#2563eb" }} />
            </Space>

            <Divider titlePlacement="start" style={{ marginTop: 20 }}>Ghi cọc (lên sheet ngay, kế toán xác nhận nội bộ sau)</Divider>
            {can("accounting.record_payment") && (
              <Form form={depForm} layout="inline" style={{ rowGap: 8, flexWrap: "wrap" }} initialValues={{ paidAt: dayjs(), currency: "VND" }}>
                <Form.Item name="amount" rules={[{ required: true, message: "Nhập số tiền" }]}>
                  <InputNumber placeholder={depCur === "JPY" ? "Số tiền ¥" : "Số tiền VND"} min={0} step={depCur === "JPY" ? 1000 : 1000000} style={{ width: 140 }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={(v) => Number((v ?? "").replace(/,/g, "")) as any} />
                </Form.Item>
                <Form.Item name="currency"><Select style={{ width: 90 }} onChange={(v) => setDepCur(v)} options={[{ value: "VND", label: "VND" }, { value: "JPY", label: "JPY" }]} /></Form.Item>
                {depCur === "JPY" && <Form.Item name="exchangeRate" rules={[{ required: true, message: "Tỉ giá" }]}><InputNumber placeholder="Tỉ giá 1¥=?đ" min={0} style={{ width: 120 }} /></Form.Item>}
                <Form.Item name="payerName"><Input placeholder="Tên người CK" style={{ width: 130 }} /></Form.Item>
                <Form.Item name="paidAt"><DatePicker format="DD/MM/YYYY" /></Form.Item>
                <Form.Item name="walletId"><Select placeholder="Ví nhận" allowClear style={{ width: 120 }}
                  options={wallets.map((w) => ({ value: w.id, label: w.name }))} /></Form.Item>
                <Form.Item name="note"><Input placeholder="Nội dung (cọc 40tr...)" style={{ width: 150 }} /></Form.Item>
                <Form.Item><Button type="primary" onClick={addDeposit}>Ghi cọc</Button></Form.Item>
              </Form>
            )}

            <Divider titlePlacement="start" style={{ marginTop: 20 }}>Đối soát theo tháng</Divider>
            <Table rowKey="month" size="small" pagination={false} dataSource={ledger.byMonth}
              columns={[
                { title: "Tháng", dataIndex: "month" },
                { title: "Đơn", dataIndex: "order", align: "right", render: (v) => vnd(v) },
                { title: "Nạp/trả", dataIndex: "paid", align: "right", render: (v) => vnd(v) },
                { title: "Dư cuối kỳ", dataIndex: "balance", align: "right",
                  render: (v) => <b style={{ color: v < 0 ? "#dc2626" : "#16a34a" }}>{vnd(v)}</b> },
              ]} />

            <Divider titlePlacement="start" style={{ marginTop: 20 }}>Lịch sử cọc</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={ledger.deposits}
              columns={[
                { title: "Ngày", dataIndex: "paidAt", render: (v) => dayjs(v).format("DD/MM/YYYY") },
                { title: "Số tiền", dataIndex: "amountVnd", align: "right", render: (v, d) => (
                  <span>{vnd(Number(v))}{d.currency === "JPY" ? <span style={{ color: "#888", fontSize: 12 }}> ({Number(d.amountOrig).toLocaleString("ja-JP")}¥)</span> : null}</span>
                ) },
                { title: "Người CK", dataIndex: "payerName", render: (v) => v ?? "-" },
                { title: "Nội dung", dataIndex: "note", render: (v) => v ?? "-" },
                { title: "Tình trạng", width: 130, render: (_, d) => (
                  <Button size="small" type={d.confirmed ? "default" : "primary"} danger={false}
                    onClick={() => can("accounting.reconcile") && toggleConfirm(d)}
                    style={d.confirmed ? { color: "#16a34a", borderColor: "#16a34a" } : { background: "#ea7a17", borderColor: "#ea7a17" }}>
                    {d.confirmed ? "✓ Đã vào" : "Chờ xác nhận"}
                  </Button>
                ) },
                { title: "", width: 40, render: (_, d) => can("accounting.record_payment") && (
                  <Popconfirm title="Xóa khoản cọc?" onConfirm={() => delDeposit(d.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                ) },
              ]} />
          </>
        )}
      </Drawer>
    </PageContainer>
  );
}

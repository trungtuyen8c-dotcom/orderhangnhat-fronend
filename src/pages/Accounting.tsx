import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Form, Select, InputNumber, Input, Button, Tag, Space, Popconfirm, Modal, DatePicker, Checkbox, App } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

const TYPE_LABEL: Record<string, string> = { deposit: "Cọc", final: "Thu nốt", refund: "Hoàn" };
const sym = (c?: string) => (c === "JPY" ? " ¥" : " ₫");
const money = (n: number | string | null | undefined, c?: string) =>
  n == null ? "-" : Number(n).toLocaleString(c === "JPY" ? "ja-JP" : "vi-VN") + sym(c);
const signed = (n: number, c?: string) => (n < 0 ? "-" : "+") + Math.abs(n).toLocaleString(c === "JPY" ? "ja-JP" : "vi-VN") + sym(c);

interface Order { id: string; code: string; status: string; }
interface Wallet { id: string; name: string; balance: string; currency?: string; }
interface StmtRow {
  id: string; date: string; amount: number; type: string; reconciled: boolean; statementRef: string | null;
  orderCode: string | null; customer: string | null; phone: string | null; trackings: string[]; balance: number;
}
interface CustomerDebt { customerId: string; code: string; name: string; phone: string | null; balance: number; updatedAt: string; }

export default function Accounting() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [stmt, setStmt] = useState<StmtRow[]>([]);
  const [stmtBalance, setStmtBalance] = useState(0);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [custQ, setCustQ] = useState("");
  const [trkQ, setTrkQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [debt, setDebt] = useState<string | null>(null);
  const [custDebts, setCustDebts] = useState<CustomerDebt[]>([]);
  const [walletModal, setWalletModal] = useState<{ mode: "create" | "edit"; w?: Wallet } | null>(null);
  const [fundBalance, setFundBalance] = useState(0);
  const [fundTxns, setFundTxns] = useState<any[]>([]);
  const [fundModal, setFundModal] = useState<"topup" | "allocate" | "set" | null>(null);
  const [form] = Form.useForm();
  const [wForm] = Form.useForm();
  const [fForm] = Form.useForm();
  const payCur = Form.useWatch("currency", form) ?? "VND";
  const payAmount = Form.useWatch("amount", form);
  const payRate = Form.useWatch("exchangeRate", form);
  const selWallet = wallets.find((w) => w.id === walletId);
  const stmtCur = selWallet?.currency ?? "VND";

  const loadStatement = (wid: string | null = walletId) => {
    if (!wid) { setStmt([]); setStmtBalance(0); return; }
    const params: Record<string, string> = { walletId: wid };
    if (range) { params.from = range[0].format("YYYY-MM-DD"); params.to = range[1].format("YYYY-MM-DD"); }
    if (custQ.trim()) params.customer = custQ.trim();
    if (trkQ.trim()) params.tracking = trkQ.trim();
    if (onlyPending) params.onlyPending = "true";
    api.get<{ rows: StmtRow[]; balance: number }>("/accounting/statement", { params })
      .then((r) => { setStmt(r.data.rows); setStmtBalance(r.data.balance); }).catch(() => {});
  };
  const loadWallets = () =>
    api.get<Wallet[]>("/accounting/wallets").then((r) => {
      setWallets(r.data);
      if (!walletId && r.data[0]) { setWalletId(r.data[0].id); loadStatement(r.data[0].id); }
    }).catch(() => {});
  const loadDebts = () => api.get<CustomerDebt[]>("/accounting/debts").then((r) => setCustDebts(r.data)).catch(() => {});
  const loadFund = () => api.get("/accounting/fund").then((r) => { setFundBalance(r.data.balance); setFundTxns(r.data.txns); }).catch(() => {});
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    loadWallets(); loadDebts(); loadFund();
  }, []);

  async function submitFund() {
    const v = await fForm.validateFields();
    const amountYen = Number(v.man) * 10000;
    try {
      if (fundModal === "topup") await api.post("/accounting/fund/topup", { amountYen, rate: v.rate, note: v.note });
      else if (fundModal === "set") await api.post("/accounting/fund/set", { amountYen, note: v.note });
      else await api.post("/accounting/fund/allocate", { walletId: v.walletId, amountYen, note: v.note });
      message.success("Đã lưu quỹ"); setFundModal(null); fForm.resetFields(); loadFund(); loadWallets();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Lưu quỹ thất bại"); }
  }

  async function onOrderChange(id: string) {
    if (!id) return setDebt(null);
    const r = await api.get(`/accounting/orders/${id}/payments`);
    setDebt(r.data.debt ? r.data.debt.balance : null);
  }

  async function record() {
    const v = await form.validateFields();
    try {
      await api.post(`/accounting/orders/${v.orderId}/payments`, { type: v.type, amount: v.amount, currency: v.currency, exchangeRate: v.exchangeRate, method: v.method, walletId: v.walletId });
      message.success("Đã ghi"); form.resetFields(); setDebt(null); loadWallets(); loadStatement(); loadDebts();
    } catch { message.error("Ghi tiền thất bại (kiểm tra quyền hoàn tiền?)"); }
  }

  async function reconcile(id: string) {
    try { await api.post(`/accounting/wallet-txns/${id}/reconcile`, {}); message.success("Đã đối soát"); loadStatement(); }
    catch { message.error("Đối soát thất bại"); }
  }

  function openWallet(mode: "create" | "edit", w?: Wallet) {
    setWalletModal({ mode, w });
    if (mode === "edit" && w) wForm.setFieldsValue({ name: w.name, currency: w.currency, balance: Number(w.balance) }); else wForm.resetFields();
  }
  async function submitWallet() {
    const v = await wForm.validateFields();
    try {
      if (walletModal!.mode === "create") await api.post("/accounting/wallets", v);
      else await api.patch(`/accounting/wallets/${walletModal!.w!.id}`, v);
      message.success("Đã lưu ví"); setWalletModal(null); loadWallets();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Lưu ví thất bại"); }
  }
  async function delWallet(id: string) {
    try { await api.delete(`/accounting/wallets/${id}`); message.success("Đã xóa ví"); loadWallets(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  return (
    <PageContainer title="Kế toán" sub="Cọc, công nợ, ví và đối soát">
      <Row gutter={16} className="stat-cards">
        {wallets.map((w) => (
          <Col xs={12} md={8} key={w.id}><Card><Statistic title={w.name} value={Number(w.balance)} suffix={w.currency === "JPY" ? "¥" : "₫"} /></Card></Col>
        ))}
      </Row>

      {can("wallets.manage") && (
        <Card title="Quỹ tổng (vốn mua hàng - JPY)" style={{ marginBottom: 16 }}
          extra={<Space>
            <Button size="small" type="primary" onClick={() => setFundModal("topup")}>Nạp quỹ</Button>
            <Button size="small" onClick={() => setFundModal("allocate")}>Phân bổ vào thẻ</Button>
            <Button size="small" onClick={() => setFundModal("set")}>Đặt số dư</Button>
          </Space>}>
          <Statistic value={fundBalance} suffix="¥" formatter={(v) => `${Number(v).toLocaleString("ja-JP")} (${(Number(v) / 10000).toLocaleString("ja-JP")} man)`} />
          <Table rowKey="id" size="small" pagination={{ pageSize: 8 }} style={{ marginTop: 12 }} dataSource={fundTxns}
            locale={{ emptyText: "Chưa có giao dịch quỹ" }}
            columns={[
              { title: "Ngày", dataIndex: "createdAt", render: (v) => new Date(v).toLocaleDateString("vi-VN") },
              { title: "Loại", dataIndex: "type", render: (v) => <Tag color={v === "topup" ? "green" : "blue"}>{v === "topup" ? "Nạp quỹ" : "Phân bổ thẻ"}</Tag> },
              { title: "Số tiền", dataIndex: "amountYen", render: (v, r) => (r.type === "topup" ? "+" : "-") + Number(v).toLocaleString("ja-JP") + " ¥ (" + (Number(v) / 10000) + " man)" },
              { title: "Tỉ giá", dataIndex: "rate", render: (v) => (v ? Number(v).toLocaleString("vi-VN") : "-") },
              { title: "Thẻ", dataIndex: "walletId", render: (v) => (v ? wallets.find((w) => w.id === v)?.name ?? "-" : "-") },
              { title: "Ghi chú", dataIndex: "note", render: (v) => v ?? "-" },
            ]} />
        </Card>
      )}

      {can("wallets.manage") && (
        <Card title="Quản lý ví" style={{ marginBottom: 16 }}
          extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openWallet("create")}>Thêm ví</Button>}>
          <Table rowKey="id" size="small" pagination={false} dataSource={wallets}
            columns={[
              { title: "Tên ví", dataIndex: "name" },
              { title: "Tiền tệ", dataIndex: "currency", width: 80, render: (v) => v ?? "VND" },
              { title: "Số dư", dataIndex: "balance", render: (v, w) => money(v, w.currency) },
              {
                title: "", width: 110, render: (_, w) => (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openWallet("edit", w)} />
                    <Popconfirm title="Xóa ví?" onConfirm={() => delWallet(w.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                  </Space>
                ),
              },
            ]} />
        </Card>
      )}

      <Card title="Ghi cọc / thu nốt / hoàn" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={record}>
          <Form.Item name="orderId" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn đơn" style={{ width: 200 }}
              onChange={onOrderChange} options={orders.map((o) => ({ value: o.id, label: o.code }))} />
          </Form.Item>
          <Form.Item name="type" initialValue="deposit">
            <Select style={{ width: 130 }} options={[
              { value: "deposit", label: "Cọc" }, { value: "final", label: "Thu nốt" }, { value: "refund", label: "Hoàn" },
            ]} />
          </Form.Item>
          <Form.Item name="amount" rules={[{ required: true }]}>
            <InputNumber min={1} placeholder="Số tiền" style={{ width: 140 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
          </Form.Item>
          <Form.Item name="currency" initialValue="VND">
            <Select style={{ width: 90 }} onChange={() => form.setFieldValue("walletId", undefined)}
              options={[{ value: "VND", label: "₫ VND" }, { value: "JPY", label: "¥ JPY" }]} />
          </Form.Item>
          {payCur === "JPY" && (
            <Form.Item name="exchangeRate" rules={[{ required: true, message: "Nhập tỉ giá" }]}>
              <InputNumber min={1} placeholder="Tỉ giá ₫/¥" style={{ width: 120 }} />
            </Form.Item>
          )}
          <Form.Item name="method" initialValue="Tiền mặt">
            <Select style={{ width: 150 }} placeholder="Hình thức" options={[
              { value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" },
              { value: "Momo", label: "Momo" }, { value: "Ví khác", label: "Ví khác" },
            ]} />
          </Form.Item>
          <Form.Item name="walletId">
            <Select allowClear placeholder={`Ví ${payCur} (tùy chọn)`} style={{ width: 160 }}
              options={wallets.filter((w) => (w.currency ?? "VND") === payCur).map((w) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Ghi</Button></Form.Item>
        </Form>
        {payCur === "JPY" && payAmount > 0 && payRate > 0 && (
          <p style={{ marginTop: 12, color: "#64748b" }}>Quy đổi: {money(payAmount, "JPY")} × {payRate} ≈ <b>{money(payAmount * payRate)}</b></p>
        )}
        {debt !== null && <p style={{ marginTop: 4 }}>Công nợ còn lại: <b>{vnd(debt)}</b></p>}
      </Card>

      <Card title="Công nợ khách hàng" style={{ marginBottom: 16 }}
        extra={<span>Tổng còn nợ: <b>{vnd(custDebts.reduce((s, d) => s + d.balance, 0))}</b></span>}>
        <Table
          rowKey="customerId" dataSource={custDebts} size="middle"
          columns={[
            { title: "Mã KH", dataIndex: "code", render: (v) => <Tag>{v}</Tag> },
            { title: "Khách", dataIndex: "name" },
            { title: "SĐT", dataIndex: "phone", render: (v) => v ?? "-" },
            { title: "Còn nợ", dataIndex: "balance", align: "right", render: (v) => <b>{vnd(v)}</b> },
            { title: "Cập nhật", dataIndex: "updatedAt", render: (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "-") },
          ]}
          locale={{ emptyText: "Không có công nợ" }}
        />
      </Card>

      <Card
        title="Sao kê & đối soát ví"
        extra={<span>Số dư: <b>{money(stmtBalance, stmtCur)}</b></span>}
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 200 }} value={walletId ?? undefined} placeholder="Chọn ví"
            onChange={(v) => { setWalletId(v); loadStatement(v); }}
            options={wallets.map((w) => ({ value: w.id, label: w.name }))}
          />
          <DatePicker.RangePicker
            value={range} format="DD/MM/YYYY" placeholder={["Từ ngày", "Đến ngày"]}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
          />
          <Input.Search
            allowClear placeholder="Tìm khách" style={{ width: 160 }}
            value={custQ} onChange={(e) => setCustQ(e.target.value)} onSearch={() => loadStatement()}
          />
          <Input.Search
            allowClear placeholder="Tìm tracking" style={{ width: 180 }}
            value={trkQ} onChange={(e) => setTrkQ(e.target.value)} onSearch={() => loadStatement()}
          />
          <Checkbox checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)}>Chỉ chưa đối soát</Checkbox>
          <Button type="primary" onClick={() => loadStatement()}>Lọc</Button>
        </Space>
        <Table
          rowKey="id" dataSource={stmt} size="middle" scroll={{ x: 640 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          columns={[
            { title: "Ngày", dataIndex: "date", width: 110, render: (v) => dayjs(v).format("DD/MM/YYYY") },
            {
              title: "Diễn giải",
              render: (_, r: StmtRow) => (
                <div>
                  <div>
                    {TYPE_LABEL[r.type] ?? r.type}
                    {r.orderCode && <> · <b>{r.orderCode}</b></>}
                    {!r.reconciled && <Tag color="orange" style={{ marginLeft: 8 }}>chờ đối soát</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {r.customer ?? "-"}
                    {r.trackings.length > 0 && <> · {r.trackings.join(", ")}</>}
                  </div>
                </div>
              ),
            },
            {
              title: "Số tiền", dataIndex: "amount", align: "right", width: 140,
              render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : "#3f8600" }}>{signed(v, stmtCur)}</span>,
            },
            { title: "Số dư", dataIndex: "balance", align: "right", width: 140, render: (v) => money(v, stmtCur) },
            {
              title: "", width: 100,
              render: (_, r: StmtRow) => (r.reconciled ? <Tag color="green">đã đối soát</Tag> : <Button size="small" onClick={() => reconcile(r.id)}>Đối soát</Button>),
            },
          ]}
          locale={{ emptyText: "Không có giao dịch" }}
        />
      </Card>

      <Modal title={walletModal?.mode === "create" ? "Thêm ví" : "Sửa ví"} open={!!walletModal} onOk={submitWallet} onCancel={() => setWalletModal(null)} okText="Lưu">
        <Form form={wForm} layout="vertical" initialValues={{ currency: "VND" }}>
          <Form.Item name="name" label="Tên ví" rules={[{ required: true }]}><Input placeholder="vd: 4356 GLOBAL" /></Form.Item>
          <Form.Item name="currency" label="Tiền tệ"><Input placeholder="JPY hoặc VND" /></Form.Item>
          <Form.Item name="balance" label="Số dư ban đầu (nhập tay)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={fundModal === "topup" ? "Nạp quỹ tổng" : fundModal === "set" ? "Đặt số dư quỹ" : "Phân bổ quỹ vào thẻ"} open={!!fundModal}
        onOk={submitFund} onCancel={() => { setFundModal(null); fForm.resetFields(); }} okText="Lưu">
        <Form form={fForm} layout="vertical">
          {fundModal === "allocate" && (
            <Form.Item name="walletId" label="Thẻ nhận" rules={[{ required: true }]}>
              <Select placeholder="Chọn thẻ" options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
            </Form.Item>
          )}
          <Form.Item name="man" label="Số tiền (man = 1 vạn yên)" rules={[{ required: true }]}>
            <InputNumber min={0} step={1} style={{ width: "100%" }} placeholder="vd: 10 = 100.000¥" addonAfter="man" />
          </Form.Item>
          {fundModal === "topup" && (
            <Form.Item name="rate" label="Tỉ giá lúc nạp (₫/1¥)"><InputNumber min={0} style={{ width: "100%" }} placeholder="vd: 175" /></Form.Item>
          )}
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

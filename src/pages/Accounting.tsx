import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Form, Select, InputNumber, Input, Button, Tag, Space, Popconfirm, Modal, App } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Order { id: string; code: string; status: string; }
interface Wallet { id: string; name: string; balance: string; currency?: string; }
interface Txn { id: string; amount: string; type: string; reconciled: boolean; wallet?: { name: string }; }
interface CustomerDebt { customerId: string; code: string; name: string; phone: string | null; balance: number; updatedAt: string; }

export default function Accounting() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [debt, setDebt] = useState<string | null>(null);
  const [custDebts, setCustDebts] = useState<CustomerDebt[]>([]);
  const [walletModal, setWalletModal] = useState<{ mode: "create" | "edit"; w?: Wallet } | null>(null);
  const [form] = Form.useForm();
  const [wForm] = Form.useForm();

  const loadRecon = () => api.get<Txn[]>("/accounting/reconcile").then((r) => setTxns(r.data)).catch(() => {});
  const loadWallets = () => api.get<Wallet[]>("/accounting/wallets").then((r) => setWallets(r.data)).catch(() => {});
  const loadDebts = () => api.get<CustomerDebt[]>("/accounting/debts").then((r) => setCustDebts(r.data)).catch(() => {});
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    loadWallets(); loadRecon(); loadDebts();
  }, []);

  async function onOrderChange(id: string) {
    if (!id) return setDebt(null);
    const r = await api.get(`/accounting/orders/${id}/payments`);
    setDebt(r.data.debt ? r.data.debt.balance : null);
  }

  async function record() {
    const v = await form.validateFields();
    try {
      await api.post(`/accounting/orders/${v.orderId}/payments`, { type: v.type, amountVnd: v.amountVnd, method: v.method, walletId: v.walletId });
      message.success("Đã ghi"); form.resetFields(); setDebt(null); loadWallets(); loadRecon(); loadDebts();
    } catch { message.error("Ghi tiền thất bại (kiểm tra quyền hoàn tiền?)"); }
  }

  async function reconcile(id: string) {
    try { await api.post(`/accounting/wallet-txns/${id}/reconcile`, {}); message.success("Đã đối soát"); loadRecon(); }
    catch { message.error("Đối soát thất bại"); }
  }

  function openWallet(mode: "create" | "edit", w?: Wallet) {
    setWalletModal({ mode, w });
    if (mode === "edit" && w) wForm.setFieldsValue({ name: w.name, currency: w.currency }); else wForm.resetFields();
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
          <Col xs={12} md={8} key={w.id}><Card><Statistic title={w.name} value={Number(w.balance)} suffix="₫" /></Card></Col>
        ))}
      </Row>

      {can("wallets.manage") && (
        <Card title="Quản lý ví" style={{ marginBottom: 16 }}
          extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openWallet("create")}>Thêm ví</Button>}>
          <Table rowKey="id" size="small" pagination={false} dataSource={wallets}
            columns={[
              { title: "Tên ví", dataIndex: "name" },
              { title: "Số dư", dataIndex: "balance", render: (v) => vnd(v) },
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
          <Form.Item name="amountVnd" rules={[{ required: true }]}>
            <InputNumber min={1} placeholder="Số tiền" style={{ width: 160 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
          </Form.Item>
          <Form.Item name="method" initialValue="Tiền mặt">
            <Select style={{ width: 150 }} placeholder="Hình thức" options={[
              { value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" },
              { value: "Momo", label: "Momo" }, { value: "Ví khác", label: "Ví khác" },
            ]} />
          </Form.Item>
          <Form.Item name="walletId">
            <Select allowClear placeholder="Ví (tùy chọn)" style={{ width: 150 }} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Ghi</Button></Form.Item>
        </Form>
        {debt !== null && <p style={{ marginTop: 12 }}>Công nợ còn lại: <b>{vnd(debt)}</b></p>}
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

      <Card title="Đối soát ví — giao dịch chưa đối soát">
        <Table
          rowKey="id" dataSource={txns} size="middle"
          columns={[
            { title: "Ví", dataIndex: ["wallet", "name"] },
            { title: "Số tiền", dataIndex: "amount", render: (v) => vnd(v) },
            { title: "Loại", dataIndex: "type", render: (v) => <Tag>{v}</Tag> },
            { title: "", render: (_, t) => <Button size="small" onClick={() => reconcile(t.id)}>Đối soát</Button> },
          ]}
          locale={{ emptyText: "Không có giao dịch chờ" }}
        />
      </Card>

      <Modal title={walletModal?.mode === "create" ? "Thêm ví" : "Sửa ví"} open={!!walletModal} onOk={submitWallet} onCancel={() => setWalletModal(null)} okText="Lưu">
        <Form form={wForm} layout="vertical" initialValues={{ currency: "VND" }}>
          <Form.Item name="name" label="Tên ví" rules={[{ required: true }]}><Input placeholder="vd: 4356 GLOBAL" /></Form.Item>
          <Form.Item name="currency" label="Tiền tệ"><Input /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

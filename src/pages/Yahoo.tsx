import { useEffect, useMemo, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  DatePicker, App, Row, Col, Popconfirm,
} from "antd";
import dayjs from "dayjs";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface Item { unitPriceJpy: string | number; qty: number; shipJpy?: string | number | null; }
interface Order { id: string; code: string; status: string; orderDate?: string; createdAt?: string; exchangeRate?: string | null; yahooPaidAt?: string | null; customer?: { name: string }; items?: Item[]; }
interface Customer { id: string; name: string; }
interface Wallet { id: string; name: string; currency: string; }

const jpy = (n: number) => n.toLocaleString() + " ¥";
const itemsJpy = (items?: Item[]) => (items ?? []).reduce((s, i) => s + Number(i.unitPriceJpy) * i.qty + (i.shipJpy != null ? Number(i.shipJpy) : 0), 0);

export default function Yahoo() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<Order | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "paid">("pending");
  const [scrapeIdx, setScrapeIdx] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();

  const scrape = async (idx: number, url: string) => {
    if (!url) return message.warning("Dán link Yahoo/Mercari trước");
    setScrapeIdx(idx);
    try {
      const r = await api.get("/scrape", { params: { url } });
      if (r.data.name) form.setFieldValue(["items", idx, "name"], r.data.name);
      if (r.data.priceJpy != null) form.setFieldValue(["items", idx, "unitPriceJpy"], r.data.priceJpy);
      if (r.data.name || r.data.priceJpy != null) message.success("Đã lấy tên/giá");
      else message.warning("Không lấy được (link hết hạn?)");
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Không lấy được"); }
    finally { setScrapeIdx(null); }
  };

  const load = () => {
    setLoading(true);
    api.get<Order[]>("/orders", { params: { source: "yahoo" } }).then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    if (can("customers.list")) api.get<Customer[]>("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get<Wallet[]>("/accounting/wallets").then((r) => setWallets(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ orderDate: dayjs(), items: [{ qty: 1 }] });
    setOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    v.source = "yahoo";
    v.orderDate = v.orderDate ? v.orderDate.format("YYYY-MM-DD") : undefined;
    try {
      await api.post("/orders", v);
      message.success("Đã tạo đơn Yahoo");
      setOpen(false); load();
    } catch { message.error("Lỗi tạo đơn"); }
  };

  const openPay = (o: Order) => {
    payForm.resetFields();
    payForm.setFieldsValue({ paidAt: dayjs() });
    setPayFor(o);
  };
  const submitPay = async () => {
    const v = await payForm.validateFields();
    try {
      await api.post(`/orders/${payFor!.id}/pay`, { walletId: v.walletId, paidAt: v.paidAt ? v.paidAt.format("YYYY-MM-DD") : undefined });
      message.success("Đã thanh toán, trừ thẻ xong");
      setPayFor(null); load();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Lỗi thanh toán"); }
  };
  const unpay = async (o: Order) => {
    try { await api.post(`/orders/${o.id}/unpay`, {}); message.success("Đã hủy thanh toán, hoàn tiền thẻ"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Lỗi"); }
  };
  const del = async (o: Order) => {
    try { await api.delete(`/orders/${o.id}`); message.success("Đã xóa đơn"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Lỗi xóa"); }
  };

  const filtered = useMemo(() => rows.filter((o) => {
    if (tab === "pending" && o.yahooPaidAt) return false;
    if (tab === "paid" && !o.yahooPaidAt) return false;
    if (q && !(`${o.code} ${o.customer?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [rows, tab, q]);

  const pendingTotal = useMemo(() => rows.filter((o) => !o.yahooPaidAt).reduce((s, o) => s + itemsJpy(o.items), 0), [rows]);

  const cols = [
    { title: "Mã", dataIndex: "code", width: 100 },
    { title: "Khách", render: (_: any, r: Order) => r.customer?.name ?? "-" },
    { title: "Ngày đơn", render: (_: any, r: Order) => { const d = r.orderDate ?? r.createdAt; return d ? new Date(d).toLocaleDateString("vi-VN") : "-"; } },
    { title: "Tiền JPY", align: "right" as const, render: (_: any, r: Order) => jpy(itemsJpy(r.items)) },
    { title: "Thanh toán", render: (_: any, r: Order) => r.yahooPaidAt
      ? <Tag color="green">Đã TT {new Date(r.yahooPaidAt).toLocaleDateString("vi-VN")}</Tag>
      : <Tag color="orange">Chờ thanh toán</Tag> },
    { title: "", align: "right" as const, render: (_: any, r: Order) => (
      <Space>
        {!r.yahooPaidAt && can("orders.update") && <Button size="small" type="primary" onClick={() => openPay(r)}>Đã thanh toán</Button>}
        {r.yahooPaidAt && can("orders.update") && <Popconfirm title="Hủy thanh toán, hoàn tiền về thẻ?" onConfirm={() => unpay(r)}><Button size="small">Hủy TT</Button></Popconfirm>}
        {!r.yahooPaidAt && can("orders.delete") && <Popconfirm title="Xóa đơn?" onConfirm={() => del(r)}><Button size="small" danger>Xóa</Button></Popconfirm>}
      </Space>
    ) },
  ];

  return (
    <PageContainer title="Thanh toán sau Yahoo" sub="Lên đơn trước, thanh toán (trừ thẻ) sau">
      <Card>
        <Space style={{ marginBottom: 12 }} wrap>
          {can("orders.create") && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo đơn Yahoo</Button>}
          <Select value={tab} onChange={setTab} style={{ width: 160 }} options={[
            { value: "pending", label: "Chờ thanh toán" }, { value: "paid", label: "Đã thanh toán" }, { value: "all", label: "Tất cả" },
          ]} />
          <Input.Search placeholder="Tìm mã / khách" allowClear value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <Tag color="orange" style={{ fontSize: 14, padding: "4px 10px" }}>Đang nợ Yahoo: {jpy(pendingTotal)}</Tag>
        </Space>
        <Table rowKey="id" size="small" loading={loading} dataSource={filtered} columns={cols} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal open={open} title="Tạo đơn Yahoo (thanh toán sau)" onCancel={() => setOpen(false)} onOk={submit} width={720} okText="Tạo đơn">
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Chọn khách"
                  options={customers.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="orderDate" label="Ngày đơn" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="exchangeRate" label="Tỉ giá"><InputNumber style={{ width: "100%" }} placeholder="VD 168" /></Form.Item>
            </Col>
          </Row>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={9}><Form.Item {...rest} name={[name, "name"]} rules={[{ required: true }]} style={{ marginBottom: 0 }}><Input placeholder="Tên món" /></Form.Item></Col>
                    <Col span={6}><Form.Item {...rest} name={[name, "url"]} style={{ marginBottom: 0 }}><Input.Search placeholder="Link Yahoo/Mercari" enterButton="Lấy" loading={scrapeIdx === name} onSearch={(val) => scrape(name, val)} /></Form.Item></Col>
                    <Col span={3}><Form.Item {...rest} name={[name, "qty"]} initialValue={1} rules={[{ required: true }]} style={{ marginBottom: 0 }}><InputNumber min={1} style={{ width: "100%" }} placeholder="SL" /></Form.Item></Col>
                    <Col span={3}><Form.Item {...rest} name={[name, "unitPriceJpy"]} rules={[{ required: true }]} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: "100%" }} placeholder="Giá ¥" /></Form.Item></Col>
                    <Col span={2}><Form.Item {...rest} name={[name, "shipJpy"]} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: "100%" }} placeholder="Ship ¥" /></Form.Item></Col>
                    <Col span={1}><MinusCircleOutlined onClick={() => remove(name)} /></Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add({ qty: 1 })} icon={<PlusOutlined />} block>Thêm món</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal open={!!payFor} title={`Thanh toán ${payFor?.code ?? ""}`} onCancel={() => setPayFor(null)} onOk={submitPay} okText="Xác nhận trừ thẻ">
        <p style={{ marginBottom: 12 }}>Tiền: <b>{jpy(itemsJpy(payFor?.items))}</b> {payFor?.exchangeRate ? "" : "(thẻ VND cần đơn có tỉ giá mới trừ được)"}</p>
        <Form form={payForm} layout="vertical">
          <Form.Item name="walletId" label="Thẻ thanh toán" rules={[{ required: true }]}>
            <Select placeholder="Chọn thẻ" options={wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }))} />
          </Form.Item>
          <Form.Item name="paidAt" label="Ngày thanh toán" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

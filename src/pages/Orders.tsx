import { useEffect, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Drawer, Descriptions, Divider, Timeline, App,
} from "antd";
import { PlusOutlined, MinusCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Popconfirm } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { STATUS_LABEL, STATUS_COLOR, NEXT, vnd } from "../lib/status";

interface Order { id: string; code: string; status: string; totalQuote: string | null; totalVnd: string | null; customer?: { name: string }; }
interface Customer { id: string; name: string; }

const jpy = (n: number | string | null | undefined) => (n == null ? "-" : Number(n).toLocaleString() + " ¥");
const CUR = [{ value: "JPY", label: "¥" }, { value: "VND", label: "₫" }];
const FIELD_LABEL: Record<string, string> = {
  customerId: "Khách hàng", items: "Món hàng", exchangeRate: "Tỉ giá",
  shipAmount: "Ship", shipCurrency: "Đơn vị ship", surchargeAmount: "Phụ thu", surchargeCurrency: "Đơn vị phụ thu",
  discountAmount: "Giảm giá", discountCurrency: "Đơn vị giảm giá", totalVnd: "Tổng VND", status: "Trạng thái",
};
const ACTION_LABEL: Record<string, string> = { created: "Tạo đơn", updated: "Sửa đơn", status_changed: "Đổi trạng thái" };

// totalVnd = subtotalJpy x tỉ giá + ship + phụ thu - giảm (JPY x tỉ giá, VND cộng thẳng)
function computeVnd(v: any): number | null {
  const rate = Number(v?.exchangeRate ?? 0);
  if (!rate) return null;
  const subtotal = (v?.items ?? []).reduce((s: number, i: any) => s + Number(i?.qty ?? 0) * Number(i?.unitPriceJpy ?? 0), 0);
  const toVnd = (amt: any, cur: any) => (cur === "JPY" ? Number(amt ?? 0) * rate : Number(amt ?? 0));
  return subtotal * rate + toVnd(v.shipAmount, v.shipCurrency) + toVnd(v.surchargeAmount, v.surchargeCurrency) - toVnd(v.discountAmount, v.discountCurrency);
}

function fmtVal(field: string, val: any) {
  if (val == null || val === "") return "-";
  if (field === "status") return STATUS_LABEL[val] ?? val;
  return String(val);
}

export default function Orders() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [form] = Form.useForm();
  const watch = Form.useWatch([], form);
  const previewVnd = computeVnd(watch);

  const load = () => { setLoading(true); api.get<Order[]>("/orders").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    if (can("customers.list")) api.get<Customer[]>("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setEditId(null); form.resetFields();
    form.setFieldsValue({ items: [{ qty: 1, unitPriceJpy: 0 }], shipCurrency: "JPY", surchargeCurrency: "VND", discountCurrency: "VND" });
    setOpen(true);
  }

  async function openEdit(id: string) {
    const r = await api.get(`/orders/${id}`);
    const o = r.data;
    setEditId(id);
    form.setFieldsValue({
      customerId: o.customerId,
      items: o.items.map((i: any) => ({ name: i.name, url: i.url, qty: i.qty, unitPriceJpy: Number(i.unitPriceJpy) })),
      exchangeRate: o.exchangeRate ? Number(o.exchangeRate) : undefined,
      shipAmount: Number(o.shipAmount), shipCurrency: o.shipCurrency,
      surchargeAmount: Number(o.surchargeAmount), surchargeCurrency: o.surchargeCurrency,
      discountAmount: Number(o.discountAmount), discountCurrency: o.discountCurrency,
    });
    setOpen(true);
  }

  async function submitOrder() {
    const v = await form.validateFields();
    try {
      if (editId) await api.patch(`/orders/${editId}`, v);
      else await api.post("/orders", v);
      message.success("Đã lưu đơn"); setOpen(false); form.resetFields(); load();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "Lưu đơn thất bại"); }
  }

  async function del(id: string) {
    try { await api.delete(`/orders/${id}`); message.success("Đã xóa đơn"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  async function changeStatus(id: string, status: string) {
    try { await api.patch(`/orders/${id}/status`, { status }); message.success("Đã chuyển trạng thái"); load(); }
    catch { message.error("Chuyển trạng thái không hợp lệ"); }
  }

  async function openDetail(id: string) {
    const r = await api.get(`/orders/${id}`);
    setDetail(r.data);
  }

  async function downloadDoc(id: string, type: string) {
    const r = await api.get(`/shipments/documents/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement("a");
    a.href = url; a.download = type; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer
      title="Đơn hàng" sub="Tạo đơn, báo giá và theo dõi vòng đời"
      extra={can("orders.create") && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo đơn</Button>}
    >
      <Card>
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Mã", dataIndex: "code" },
          { title: "Khách", dataIndex: ["customer", "name"] },
          { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag> },
          { title: "Báo giá", dataIndex: "totalQuote", render: (v) => jpy(v) },
          { title: "Tổng VND", dataIndex: "totalVnd", render: (v) => vnd(v) },
          {
            title: "Hành động", render: (_, o) => (
              <Space wrap>
                <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(o.id)}>Chi tiết</Button>
                {can("orders.update") && ["draft", "quoted"].includes(o.status) && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(o.id)} />}
                {can("orders.update_status") && (NEXT[o.status] ?? []).map((ns) => (
                  <Button key={ns} size="small" type="dashed" onClick={() => changeStatus(o.id, ns)}>{STATUS_LABEL[ns] ?? ns}</Button>
                ))}
                {can("orders.delete") && <Popconfirm title="Xóa đơn này?" onConfirm={() => del(o.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
              </Space>
            ),
          },
        ]}
      />

      <Modal title={editId ? "Sửa đơn" : "Tạo đơn"} open={open} onOk={submitOrder} onCancel={() => { setOpen(false); setEditId(null); }} okText="Lưu" width={680}>
        <Form form={form} layout="vertical">
          <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn khách"
              options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Divider>Món hàng</Divider>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, "name"]} rules={[{ required: true }]}><Input placeholder="Tên món" /></Form.Item>
                    <Form.Item {...rest} name={[name, "qty"]} rules={[{ required: true }]}><InputNumber min={1} placeholder="SL" /></Form.Item>
                    <Form.Item {...rest} name={[name, "unitPriceJpy"]} rules={[{ required: true }]}><InputNumber min={0} placeholder="Giá ¥" /></Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ qty: 1, unitPriceJpy: 0 })} block icon={<PlusOutlined />}>Thêm món</Button>
              </>
            )}
          </Form.List>

          <Divider>Tỉ giá & phí</Divider>
          <Form.Item name="exchangeRate" label="Tỉ giá (₫ / 1¥)">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="VD: 175" />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item label="Ship">
              <Space.Compact>
                <Form.Item name="shipAmount" noStyle><InputNumber min={0} placeholder="0" /></Form.Item>
                <Form.Item name="shipCurrency" noStyle><Select options={CUR} style={{ width: 64 }} /></Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="Phụ thu">
              <Space.Compact>
                <Form.Item name="surchargeAmount" noStyle><InputNumber min={0} placeholder="0" /></Form.Item>
                <Form.Item name="surchargeCurrency" noStyle><Select options={CUR} style={{ width: 64 }} /></Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="Giảm giá">
              <Space.Compact>
                <Form.Item name="discountAmount" noStyle><InputNumber min={0} placeholder="0" /></Form.Item>
                <Form.Item name="discountCurrency" noStyle><Select options={CUR} style={{ width: 64 }} /></Form.Item>
              </Space.Compact>
            </Form.Item>
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ textAlign: "right", fontSize: 16 }}>
            Tổng VND: <b>{previewVnd == null ? "(nhập tỉ giá)" : vnd(previewVnd)}</b>
          </div>
        </Form>
      </Modal>

      <Drawer title={detail?.code} open={!!detail} onClose={() => setDetail(null)} width={560}>
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Khách">{detail.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag></Descriptions.Item>
              <Descriptions.Item label="Báo giá (¥)">{jpy(detail.totalQuote)}</Descriptions.Item>
              <Descriptions.Item label="Tỉ giá">{detail.exchangeRate ? Number(detail.exchangeRate).toLocaleString("vi-VN") + " ₫/¥" : "-"}</Descriptions.Item>
              <Descriptions.Item label="Ship">{Number(detail.shipAmount).toLocaleString()} {detail.shipCurrency}</Descriptions.Item>
              <Descriptions.Item label="Phụ thu">{Number(detail.surchargeAmount).toLocaleString()} {detail.surchargeCurrency}</Descriptions.Item>
              <Descriptions.Item label="Giảm giá">{Number(detail.discountAmount).toLocaleString()} {detail.discountCurrency}</Descriptions.Item>
              <Descriptions.Item label="Tổng VND"><b>{vnd(detail.totalVnd)}</b></Descriptions.Item>
              <Descriptions.Item label="Công nợ">{detail.debt ? vnd(detail.debt.balance) : "-"}</Descriptions.Item>
            </Descriptions>
            <Divider>Món hàng</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.items}
              columns={[{ title: "Tên", dataIndex: "name" }, { title: "SL", dataIndex: "qty" }, { title: "Giá ¥", dataIndex: "unitPriceJpy", render: (v) => Number(v).toLocaleString() }]} />
            <Divider>Tracking</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.trackings}
              locale={{ emptyText: "Chưa có" }}
              columns={[{ title: "Mã", dataIndex: "code" }, { title: "Tên JP", dataIndex: "jpName" }, { title: "Cân", dataIndex: "jpWeightKg" }]} />
            <Divider>Thanh toán</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.payments}
              locale={{ emptyText: "Chưa có" }}
              columns={[{ title: "Loại", dataIndex: "type" }, { title: "Số tiền", dataIndex: "amountVnd", render: (v) => vnd(v) }]} />
            <Divider>Lịch sử chỉnh sửa</Divider>
            {detail.logs?.length ? (
              <Timeline
                items={detail.logs.map((l: any) => ({
                  children: (
                    <div>
                      <div>
                        <b>{ACTION_LABEL[l.action] ?? l.action}</b>
                        {" - "}{l.actorName ?? "?"}{" - "}{new Date(l.createdAt).toLocaleString("vi-VN")}
                      </div>
                      {Array.isArray(l.changes) && l.changes.map((c: any, idx: number) => (
                        <div key={idx} style={{ fontSize: 12, color: "#666" }}>
                          {FIELD_LABEL[c.field] ?? c.field}: {fmtVal(c.field, c.old)} → {fmtVal(c.field, c.new)}
                        </div>
                      ))}
                    </div>
                  ),
                }))}
              />
            ) : <span style={{ color: "#999" }}>Chưa có</span>}
            <Divider>Chứng từ</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.documents}
              locale={{ emptyText: "Chưa có" }}
              columns={[
                { title: "Loại", dataIndex: "type" },
                { title: "", render: (_: any, d: any) => <a onClick={() => downloadDoc(d.id, d.type)}>Tải</a> },
              ]} />
          </>
        )}
      </Drawer>
      </Card>
    </PageContainer>
  );
}

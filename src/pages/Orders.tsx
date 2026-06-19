import { useEffect, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Drawer, Descriptions, Divider, App,
} from "antd";
import { PlusOutlined, MinusCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Popconfirm } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { STATUS_LABEL, STATUS_COLOR, NEXT, vnd } from "../lib/status";

interface Order { id: string; code: string; status: string; totalQuote: string | null; customer?: { name: string }; }
interface Customer { id: string; name: string; }

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

  const load = () => { setLoading(true); api.get<Order[]>("/orders").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    if (can("customers.list")) api.get<Customer[]>("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  function openCreate() { setEditId(null); form.resetFields(); form.setFieldsValue({ items: [{ qty: 1, unitPriceJpy: 0 }] }); setOpen(true); }

  async function openEdit(id: string) {
    const r = await api.get(`/orders/${id}`);
    setEditId(id);
    form.setFieldsValue({ customerId: r.data.customerId, items: r.data.items.map((i: any) => ({ name: i.name, qty: i.qty, unitPriceJpy: Number(i.unitPriceJpy) })) });
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
          { title: "Báo giá", dataIndex: "totalQuote", render: (v) => (v ? Number(v).toLocaleString() + " ¥" : "-") },
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

      <Modal title={editId ? "Sửa đơn" : "Tạo đơn"} open={open} onOk={submitOrder} onCancel={() => { setOpen(false); setEditId(null); }} okText="Lưu" width={640}>
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
        </Form>
      </Modal>

      <Drawer title={detail?.code} open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Khách">{detail.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag></Descriptions.Item>
              <Descriptions.Item label="Báo giá">{detail.totalQuote ? Number(detail.totalQuote).toLocaleString() + " ¥" : "-"}</Descriptions.Item>
              <Descriptions.Item label="Công nợ">{detail.debt ? vnd(detail.debt.balance) : "-"}</Descriptions.Item>
            </Descriptions>
            <Divider>Món hàng</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.items}
              columns={[{ title: "Tên", dataIndex: "name" }, { title: "SL", dataIndex: "qty" }, { title: "Giá ¥", dataIndex: "unitPriceJpy" }]} />
            <Divider>Tracking</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.trackings}
              locale={{ emptyText: "Chưa có" }}
              columns={[{ title: "Mã", dataIndex: "code" }, { title: "Tên JP", dataIndex: "jpName" }, { title: "Cân", dataIndex: "jpWeightKg" }]} />
            <Divider>Thanh toán</Divider>
            <Table rowKey="id" size="small" pagination={false} dataSource={detail.payments}
              locale={{ emptyText: "Chưa có" }}
              columns={[{ title: "Loại", dataIndex: "type" }, { title: "Số tiền", dataIndex: "amountVnd", render: (v) => vnd(v) }]} />
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

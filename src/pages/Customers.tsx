import { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Space, Popconfirm, App } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Customer { id: string; code?: string | null; name: string; fbZalo?: string | null; phone?: string | null; address?: string | null; note?: string | null; sheetId?: string | null; revenue?: number; debt?: number; }

export default function Customers() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<{ mode: "create" | "edit"; row?: Customer } | null>(null);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); api.get<Customer[]>("/customers").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((c) => [c.name, c.phone, c.code, c.fbZalo].some((x) => (x ?? "").toLowerCase().includes(kw)));
  }, [rows, q]);

  function open(mode: "create" | "edit", row?: Customer) {
    setEdit({ mode, row });
    if (mode === "edit" && row) form.setFieldsValue({ ...row, sheetUrl: row.sheetId ?? undefined }); else form.resetFields();
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
              title: "", width: 110, render: (_, r) => (
                <Space>
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
            <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  );
}

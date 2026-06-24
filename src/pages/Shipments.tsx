import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Select, Upload, Tag, App, Space, Popconfirm } from "antd";
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface S { id: string; code: string; status: string; _count?: { trackings: number; documents: number }; }
interface Trk { id: string; code: string; review: string | null; order?: { code: string; customer?: { name: string } } | null; }
const DOC_TYPES = ["invoice", "packing", "ingredient", "purchase_invoice", "tax"];

export default function Shipments() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<S[]>([]);
  const [trks, setTrks] = useState<Trk[]>([]);
  const [loading, setLoading] = useState(false);
  const [openS, setOpenS] = useState(false);
  const [openD, setOpenD] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [editShip, setEditShip] = useState<S | null>(null);
  const [sForm] = Form.useForm();
  const [dForm] = Form.useForm();
  const [eForm] = Form.useForm();

  const load = () => { setLoading(true); api.get<S[]>("/shipments").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  const loadTrk = () => api.get<Trk[]>("/trackings").then((r) => setTrks(r.data)).catch(() => {});
  useEffect(() => { load(); loadTrk(); }, []);

  async function saveReview(id: string, review: string) {
    try { await api.patch(`/trackings/${id}`, { review }); message.success("Đã lưu đánh giá"); loadTrk(); }
    catch { message.error("Lưu đánh giá thất bại"); }
  }

  async function createShipment() {
    const v = await sForm.validateFields();
    try { await api.post("/shipments", v); message.success("Đã tạo chuyến"); setOpenS(false); sForm.resetFields(); load(); }
    catch { message.error("Tạo chuyến thất bại"); }
  }

  async function uploadDoc() {
    const v = await dForm.validateFields();
    const file = fileList[0]?.originFileObj;
    if (!file) return message.error("Chọn file");
    const fd = new FormData();
    fd.append("file", file); fd.append("type", v.type);
    if (v.shipmentId) fd.append("shipmentId", v.shipmentId);
    try { await api.post("/shipments/documents", fd); message.success("Đã tải chứng từ"); setOpenD(false); dForm.resetFields(); setFileList([]); load(); }
    catch { message.error("Upload thất bại"); }
  }

  function openEdit(s: S) { setEditShip(s); eForm.setFieldsValue({ code: s.code, status: s.status }); }
  async function saveEdit() {
    const v = await eForm.validateFields();
    try { await api.patch(`/shipments/${editShip!.id}`, v); message.success("Đã lưu"); setEditShip(null); load(); }
    catch { message.error("Lưu thất bại"); }
  }
  async function del(id: string) {
    try { await api.delete(`/shipments/${id}`); message.success("Đã xóa"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Xóa thất bại"); }
  }

  return (
    <PageContainer
      title="Chuyến & Chứng từ" sub="Gom chuyến và quản lý bộ chứng từ GA"
      extra={<Space>
        {can("shipments.upload_doc") && <Button icon={<UploadOutlined />} onClick={() => setOpenD(true)}>Tải chứng từ GA</Button>}
        {can("shipments.create") && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenS(true)}>Tạo chuyến</Button>}
      </Space>}
    >
      <Card>
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Mã chuyến", dataIndex: "code" },
          { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag>{v}</Tag> },
          { title: "Tracking", dataIndex: ["_count", "trackings"] },
          { title: "Chứng từ", dataIndex: ["_count", "documents"] },
          {
            title: "", width: 110, render: (_, s) => (
              <Space>
                {can("shipments.update") && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(s)} />}
                {can("shipments.delete") && <Popconfirm title="Xóa chuyến?" onConfirm={() => del(s.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
              </Space>
            ),
          },
        ]}
      />

      </Card>

      <Card title="Đánh giá hàng (theo tracking)" style={{ marginTop: 16 }}>
        <Table
          rowKey="id" dataSource={trks} size="small" pagination={{ pageSize: 20 }}
          columns={[
            { title: "Mã tracking", dataIndex: "code", width: 180 },
            { title: "Đơn", dataIndex: ["order", "code"], width: 110, render: (v) => v ?? "-" },
            { title: "Khách", dataIndex: ["order", "customer", "name"], render: (v) => v ?? "-" },
            {
              title: "Đánh giá", dataIndex: "review", width: 360,
              render: (v, t) => (
                <Input defaultValue={v ?? ""} placeholder="Nhập đánh giá / tình trạng hàng"
                  onBlur={(e) => { if ((e.target.value || "") !== (v ?? "")) saveReview(t.id, e.target.value); }} />
              ),
            },
          ]}
          locale={{ emptyText: "Chưa có tracking" }}
        />
      </Card>

      <Modal title="Tạo chuyến" open={openS} onOk={createShipment} onCancel={() => setOpenS(false)} okText="Lưu">
        <Form form={sForm} layout="vertical"><Form.Item name="code" label="Mã chuyến" rules={[{ required: true }]}><Input /></Form.Item></Form>
      </Modal>

      <Modal title="Sửa chuyến" open={!!editShip} onOk={saveEdit} onCancel={() => setEditShip(null)} okText="Lưu">
        <Form form={eForm} layout="vertical">
          <Form.Item name="code" label="Mã chuyến" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="Trạng thái"><Select options={["open", "departed", "arrived", "closed"].map((s) => ({ value: s, label: s }))} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Tải chứng từ GA" open={openD} onOk={uploadDoc} onCancel={() => setOpenD(false)} okText="Tải lên">
        <Form form={dForm} layout="vertical" initialValues={{ type: "invoice" }}>
          <Form.Item name="type" label="Loại chứng từ"><Select options={DOC_TYPES.map((t) => ({ value: t, label: t }))} /></Form.Item>
          <Form.Item name="shipmentId" label="Chuyến (tùy chọn)">
            <Select allowClear options={rows.map((s) => ({ value: s.id, label: s.code }))} />
          </Form.Item>
          <Form.Item label="File">
            <Upload beforeUpload={() => false} fileList={fileList} onChange={(i) => setFileList(i.fileList.slice(-1))} maxCount={1}>
              <Button icon={<UploadOutlined />}>Chọn file</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

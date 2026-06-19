import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Select, Upload, Tag, App, Space } from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface S { id: string; code: string; status: string; _count?: { trackings: number; documents: number }; }
const DOC_TYPES = ["invoice", "packing", "ingredient", "purchase_invoice", "tax"];

export default function Shipments() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<S[]>([]);
  const [loading, setLoading] = useState(false);
  const [openS, setOpenS] = useState(false);
  const [openD, setOpenD] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [sForm] = Form.useForm();
  const [dForm] = Form.useForm();

  const load = () => { setLoading(true); api.get<S[]>("/shipments").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

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
        ]}
      />

      <Modal title="Tạo chuyến" open={openS} onOk={createShipment} onCancel={() => setOpenS(false)} okText="Lưu">
        <Form form={sForm} layout="vertical"><Form.Item name="code" label="Mã chuyến" rules={[{ required: true }]}><Input /></Form.Item></Form>
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
      </Card>
    </PageContainer>
  );
}

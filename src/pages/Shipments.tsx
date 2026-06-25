import { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Upload, Tag, App, Space, Popconfirm, DatePicker, Segmented, Badge } from "antd";
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { UploadFile } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface S { id: string; code: string; status: string; _count?: { trackings: number; documents: number }; }
interface Trk { id: string; code: string; review: string | null; jpWeightKg: string | null; unitPriceVndPerKg: string | null; url: string | null; packedAt: string | null; vnTrackingCode: string | null; orderId: string | null; order?: { code: string; customer?: { name: string } } | null; }
interface Order { id: string; code: string; customer?: { name: string }; }

// Trạng thái kiện suy ra từ dữ liệu -> chấm màu
function trkStatus(t: { vnTrackingCode: string | null; packedAt: string | null; jpWeightKg: string | null }) {
  if (t.vnTrackingCode) return { key: "vn", color: "#16a34a", label: "Về kho VN" };
  if (t.packedAt) return { key: "packed", color: "#ea7a17", label: "Đóng hàng về" };
  if (Number(t.jpWeightKg ?? 0) > 0) return { key: "jp", color: "#2563eb", label: "Kho Nhật" };
  return { key: "new", color: "#94a3b8", label: "Mới" };
}
const DOC_TYPES = ["invoice", "packing", "ingredient", "purchase_invoice", "tax"];

export default function Shipments() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rows, setRows] = useState<S[]>([]);
  const [trks, setTrks] = useState<Trk[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [openT, setOpenT] = useState(false);
  const [tForm] = Form.useForm();
  const [trkQ, setTrkQ] = useState("");
  const [revF, setRevF] = useState<"todo" | "done" | "all">("todo");
  const [statusF, setStatusF] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const shownTrks = useMemo(() => {
    const nq = norm(trkQ.trim());
    return trks.filter((t) => {
      if (revF === "todo" && t.review) return false;
      if (revF === "done" && !t.review) return false;
      if (statusF !== "all" && trkStatus(t).key !== statusF) return false;
      if (!nq) return true;
      return norm([t.code, t.order?.code, t.order?.customer?.name].filter(Boolean).join(" ")).includes(nq);
    });
  }, [trks, trkQ, revF, statusF]);
  const todoCount = useMemo(() => trks.filter((t) => !t.review).length, [trks]);
  const [openS, setOpenS] = useState(false);
  const [openD, setOpenD] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [editShip, setEditShip] = useState<S | null>(null);
  const [sForm] = Form.useForm();
  const [dForm] = Form.useForm();
  const [eForm] = Form.useForm();
  const [openK, setOpenK] = useState(false);
  const [khoUrl, setKhoUrl] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = () => { setLoading(true); api.get<S[]>("/shipments").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  const loadTrk = () => api.get<Trk[]>("/trackings").then((r) => setTrks(r.data)).catch(() => {});
  useEffect(() => {
    load(); loadTrk();
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    if (can("system.manage_settings")) api.get<{ sheetUrl: string }>("/warehouse/pack-config").then((r) => setKhoUrl(r.data.sheetUrl ?? "")).catch(() => {});
  }, []);

  async function saveKhoCfg() {
    try { await api.put("/warehouse/pack-config", { sheetUrl: khoUrl }); message.success("Đã lưu link file kho"); setOpenK(false); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Lưu thất bại"); }
  }
  async function syncPack() {
    setSyncing(true);
    try { const r = await api.post<{ matched: number; updated: number }>("/warehouse/sync-pack"); message.success(`Quét kho xong: ${r.data.updated} kiện đóng hàng về`); loadTrk(); }
    catch { message.error("Quét kho thất bại"); }
    finally { setSyncing(false); }
  }

  async function saveReview(id: string, review: string) {
    try { await api.patch(`/trackings/${id}`, { review }); message.success("Đã lưu đánh giá"); loadTrk(); }
    catch { message.error("Lưu đánh giá thất bại"); }
  }

  async function addTracking() {
    const v = await tForm.validateFields();
    const body = { ...v, packedAt: v.packedAt ? v.packedAt.toISOString() : undefined };
    try { await api.post("/trackings", body); message.success("Đã thêm tracking, đã gắn vào đơn"); setOpenT(false); tForm.resetFields(); loadTrk(); }
    catch { message.error("Thêm tracking thất bại"); }
  }
  async function delTracking(id: string) {
    try { await api.delete(`/trackings/${id}`); message.success("Đã xóa"); loadTrk(); }
    catch { message.error("Xóa thất bại"); }
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
      title="Chuyến & Chứng từ & Đánh giá" sub="Gom chuyến, chứng từ GA và đánh giá hàng theo tracking"
      extra={<Space>
        {can("system.manage_settings") && <Button onClick={() => setOpenK(true)}>Cài đặt file kho</Button>}
        {can("system.manage_settings") && <Button loading={syncing} onClick={syncPack}>Đồng bộ kho</Button>}
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

      <Card title={`Tracking & Đánh giá hàng (chưa đánh giá: ${todoCount})`} style={{ marginTop: 16 }}
        extra={can("trackings.create") && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setOpenT(true)}>Thêm tracking</Button>}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input.Search allowClear placeholder="Tìm mã tracking / đơn / khách" style={{ width: 300 }}
            value={trkQ} onChange={(e) => setTrkQ(e.target.value)} />
          <Segmented value={revF} onChange={(v) => setRevF(v as any)}
            options={[{ label: "Chưa đánh giá", value: "todo" }, { label: "Đã đánh giá", value: "done" }, { label: "Tất cả", value: "all" }]} />
          <Select value={statusF} onChange={setStatusF} style={{ width: 160 }}
            options={[{ value: "all", label: "Mọi tình trạng" }, { value: "new", label: "🔘 Mới" }, { value: "jp", label: "🔵 Kho Nhật" }, { value: "packed", label: "🟠 Đóng hàng về" }, { value: "vn", label: "🟢 Về kho VN" }]} />
        </Space>
        <Table
          rowKey="id" dataSource={shownTrks} size="small" pagination={{ pageSize: 20, showSizeChanger: true }}
          columns={[
            { title: "Tình trạng", width: 130, render: (_, t) => { const s = trkStatus(t); return <Badge color={s.color} text={s.label} />; } },
            { title: "Mã tracking", dataIndex: "code", width: 150 },
            { title: "Link", dataIndex: "url", width: 60, render: (v) => (v ? <a href={v} target="_blank" rel="noreferrer">Xem</a> : "-") },
            { title: "Đóng hàng về", dataIndex: "packedAt", width: 110, render: (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "-") },
            { title: "Đơn", dataIndex: ["order", "code"], width: 90, render: (v) => v ?? "-" },
            { title: "Khách", dataIndex: ["order", "customer", "name"], width: 110, render: (v) => v ?? "-" },
            { title: "Cân", dataIndex: "jpWeightKg", width: 60, render: (v) => (v ? Number(v) : "-") },
            { title: "Đ/kg", dataIndex: "unitPriceVndPerKg", width: 80, render: (v) => (v ? Number(v).toLocaleString("vi-VN") : "-") },
            {
              title: "Đánh giá", dataIndex: "review",
              render: (v, t) => (
                <Input defaultValue={v ?? ""} placeholder="Đánh giá / tình trạng hàng"
                  onBlur={(e) => { if ((e.target.value || "") !== (v ?? "")) saveReview(t.id, e.target.value); }} />
              ),
            },
            ...(can("trackings.delete") ? [{
              title: "", width: 50, render: (_: any, t: Trk) => (
                <Popconfirm title="Xóa tracking?" onConfirm={() => delTracking(t.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
              ),
            }] : []),
          ]}
          locale={{ emptyText: "Chưa có tracking" }}
        />
      </Card>

      <Modal title="Thêm tracking" open={openT} onOk={addTracking} onCancel={() => setOpenT(false)} okText="Lưu">
        <Form form={tForm} layout="vertical">
          <Form.Item name="code" label="Mã vận đơn" rules={[{ required: true }]}><Input placeholder="Mã tracking" /></Form.Item>
          <Form.Item name="orderId" label="Gắn vào đơn" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn đơn"
              options={orders.map((o) => ({ value: o.id, label: `${o.code} - ${o.customer?.name ?? ""}` }))} />
          </Form.Item>
          <Form.Item name="url" label="Link sản phẩm (để bấm xem khi đánh giá)"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="packedAt" label="Ngày đóng hàng về" initialValue={dayjs()}><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="jpWeightKg" label="Cân (kg)"><InputNumber min={0} step={0.1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="unitPriceVndPerKg" label="Đơn giá ship (đ/kg)"><InputNumber min={0} step={1000} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

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

      <Modal title="Cài đặt file kho (bên đóng hàng)" open={openK} onOk={saveKhoCfg} onCancel={() => setOpenK(false)} okText="Lưu">
        <p style={{ marginTop: 0, color: "#666" }}>
          Dán link Google Sheet của bên đóng hàng. File phải share quyền xem cho service account.
          Cột E = mã tracking; ngày đóng lấy theo tên tab ("26.6" = 26/6). Hệ thống quét mỗi 15 phút, mã trùng tracking sẽ chuyển 🟠 "Đóng hàng về".
        </p>
        <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={khoUrl} onChange={(e) => setKhoUrl(e.target.value)} />
      </Modal>
    </PageContainer>
  );
}

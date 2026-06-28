import { useEffect, useMemo, useState } from "react";
import { Card, Table, Form, Select, InputNumber, Input, Button, Tag, Modal, Space, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";

interface Order { id: string; code: string; }
interface Shipment { id: string; code: string; }
interface Trk {
  id: string; code: string; orderId: string | null; vnTrackingCode: string | null;
  jpWeightKg: string | null; vnWeightKg: string | null; unitPriceVndPerKg: string | null;
  order?: { code: string; customer?: { name: string } | null } | null;
}
type Edit = { vnWeightKg?: number | null; vnTrackingCode?: string };

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

export default function Warehouse() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [trks, setTrks] = useState<Trk[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [stock, setStock] = useState<Trk[]>([]);
  const [stockSel, setStockSel] = useState<string[]>([]);
  const [vnCode, setVnCode] = useState("");

  const loadStock = () => api.get<Trk[]>("/trackings", { params: { stock: 1 } }).then((r) => setStock(r.data)).catch(() => {});

  const loadTrks = (sid: string | null = shipmentId) => {
    if (!sid) { setTrks([]); return; }
    setLoading(true);
    api.get<Trk[]>("/trackings", { params: { shipmentId: sid } })
      .then((r) => { setTrks(r.data); setEdits({}); }).finally(() => setLoading(false));
  };
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    api.get<Shipment[]>("/shipments").then((r) => setShipments(r.data)).catch(() => {});
    loadStock();
  }, []);

  async function gop() {
    if (!stockSel.length) return message.info("Chọn ít nhất 1 kiện");
    if (!vnCode.trim()) return message.error("Nhập mã tracking VN để gộp");
    try {
      await api.post("/trackings/assign-vn", { ids: stockSel, vnTrackingCode: vnCode.trim() });
      message.success(`Đã gộp ${stockSel.length} kiện vào tracking VN`); setStockSel([]); setVnCode(""); loadStock(); loadTrks();
    } catch { message.error("Gộp thất bại"); }
  }

  // Cân hiệu lực = cân VN đã sửa/đã lưu, chưa có thì cân JP (tạm tính).
  const effWeight = (t: Trk) => {
    const e = edits[t.id];
    if (e?.vnWeightKg !== undefined) return e.vnWeightKg ?? 0;
    return t.vnWeightKg != null ? Number(t.vnWeightKg) : Number(t.jpWeightKg ?? 0);
  };

  async function saveRow(t: Trk) {
    const e = edits[t.id] ?? {};
    const body: Record<string, unknown> = {};
    if (e.vnWeightKg !== undefined) { body.vnWeightKg = e.vnWeightKg ?? 0; body.status = "vn_weighed"; }
    if (e.vnTrackingCode !== undefined) body.vnTrackingCode = e.vnTrackingCode;
    if (Object.keys(body).length === 0) return message.info("Chưa thay đổi");
    try { await api.patch(`/trackings/${t.id}`, body); message.success("Đã lưu"); loadTrks(); }
    catch { message.error("Lưu thất bại"); }
  }

  async function addTracking() {
    const v = await addForm.validateFields();
    const body: Record<string, unknown> = { code: v.code };
    if (v.orderId) body.orderId = v.orderId;
    if (shipmentId) body.shipmentId = shipmentId;
    if (v.vnWeightKg != null) body.vnWeightKg = v.vnWeightKg;
    if (v.vnTrackingCode) body.vnTrackingCode = v.vnTrackingCode;
    try {
      await api.post("/trackings", body);
      message.success("Đã thêm tracking"); setAddOpen(false); addForm.resetFields(); loadTrks(); loadStock();
    } catch { message.error("Thêm tracking thất bại"); }
  }

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return trks;
    return trks.filter((t) =>
      [t.code, t.vnTrackingCode, t.order?.code, t.order?.customer?.name].some((x) => (x ?? "").toLowerCase().includes(kw)));
  }, [trks, q]);

  const totalJp = useMemo(() => shown.reduce((s, t) => s + Number(t.jpWeightKg ?? 0), 0), [shown]);
  const totalVn = useMemo(() => shown.reduce((s, t) => s + effWeight(t), 0), [shown, edits]);
  const diff = Number((totalVn - totalJp).toFixed(3));

  return (
    <PageContainer title="Kho VN" sub="Chọn kiện, cân từng tracking, đối soát tổng cân">
      <Card
        title="Cân & đối soát theo kiện"
        extra={
          <Space>
            <Select style={{ width: 180 }} placeholder="Chọn kiện" value={shipmentId ?? undefined}
              showSearch optionFilterProp="label" onChange={(v) => { setShipmentId(v); loadTrks(v); }}
              options={shipments.map((s) => ({ value: s.id, label: s.code }))} />
            <Input.Search allowClear placeholder="Tìm khách / tracking / đơn" style={{ width: 220 }}
              value={q} onChange={(e) => setQ(e.target.value)} />
            <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm tracking tay</Button>
          </Space>
        }
      >
        <Table
          rowKey="id" loading={loading} dataSource={shown} size="middle" pagination={false} scroll={{ x: 900 }}
          columns={[
            { title: "Tracking", dataIndex: "code" },
            { title: "Đơn", render: (_, t: Trk) => (t.order?.code ? <b>{t.order.code}</b> : <Tag color="warning">chưa gắn</Tag>) },
            { title: "Khách", render: (_, t: Trk) => t.order?.customer?.name ?? "-" },
            { title: "Cân JP", dataIndex: "jpWeightKg", width: 90, render: (v) => v ?? "-" },
            {
              title: "Cân VN (kg)", width: 140,
              render: (_, t: Trk) => (
                <InputNumber min={0} step={0.001} style={{ width: 120 }}
                  value={edits[t.id]?.vnWeightKg !== undefined ? edits[t.id]!.vnWeightKg : num(t.vnWeightKg)}
                  onChange={(val) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], vnWeightKg: val } }))} />
              ),
            },
            {
              title: "Tracking VN", width: 160,
              render: (_, t: Trk) => (
                <Input style={{ width: 140 }} placeholder="-"
                  value={edits[t.id]?.vnTrackingCode !== undefined ? edits[t.id]!.vnTrackingCode : (t.vnTrackingCode ?? "")}
                  onChange={(e) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], vnTrackingCode: e.target.value } }))} />
              ),
            },
            { title: "", width: 80, render: (_, t: Trk) => <Button size="small" type="primary" onClick={() => saveRow(t)}>Lưu</Button> },
          ]}
          locale={{ emptyText: shipmentId ? "Kiện chưa có tracking" : "Chọn kiện để xem" }}
          summary={() =>
            shown.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><b>Tổng kiện</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><b>{totalJp.toFixed(3)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <b>{totalVn.toFixed(3)}</b>{" "}
                  {diff !== 0 ? <Tag color="error">chênh {diff}</Tag> : <Tag color="success">khớp</Tag>}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={2} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      <Card title={`Hàng tồn kho - chờ đóng đi VN (${stock.length})`} style={{ marginTop: 16 }}
        extra={
          <Space>
            <Input placeholder="Mã tracking VN để gộp" value={vnCode} onChange={(e) => setVnCode(e.target.value)} style={{ width: 200 }} />
            <Button type="primary" disabled={!stockSel.length} onClick={gop}>Gộp {stockSel.length ? `(${stockSel.length})` : ""} vào tracking VN</Button>
          </Space>
        }>
        <p style={{ marginTop: 0, color: "#666" }}>Hàng đã về kho nhưng chưa có tracking VN. Chọn nhiều kiện của cùng khách rồi gộp vào 1 mã tracking VN để vận chuyển; gộp xong sẽ rời khỏi tồn kho.</p>
        <Table
          rowKey="id" size="small" dataSource={stock} pagination={{ pageSize: 20 }}
          rowSelection={{ selectedRowKeys: stockSel, onChange: (k) => setStockSel(k as string[]) }}
          locale={{ emptyText: "Không có hàng tồn" }}
          columns={[
            { title: "Tracking", dataIndex: "code" },
            { title: "Đơn", render: (_, t: Trk) => t.order?.code ?? <Tag color="warning">chưa gắn</Tag> },
            { title: "Khách", render: (_, t: Trk) => t.order?.customer?.name ?? "-" },
            { title: "Cân VN (kg)", dataIndex: "vnWeightKg", render: (v, t: Trk) => v ?? t.jpWeightKg ?? "-" },
          ]} />
      </Card>

      <Modal title="Thêm tracking vào kiện" open={addOpen} onOk={addTracking} onCancel={() => setAddOpen(false)} okText="Thêm">
        <Form form={addForm} layout="vertical">
          <Form.Item name="orderId" label="Đơn (mã) - để trống nếu hàng khách mang lên / ký gửi">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn mã đơn (tùy chọn)" options={orders.map((o) => ({ value: o.id, label: o.code }))} />
          </Form.Item>
          <Form.Item name="code" label="Mã tracking" rules={[{ required: true }]} tooltip="Số tracking, hoặc jpYYMMDD nếu no-track">
            <Input placeholder="vd: 1234567890 hoặc jp240620" />
          </Form.Item>
          <Form.Item name="vnWeightKg" label="Cân VN (kg)"><InputNumber min={0} step={0.001} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="vnTrackingCode" label="Tracking VN"><Input /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

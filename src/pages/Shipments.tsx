import { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Upload, Tag, App, Space, Popconfirm, DatePicker, Segmented, Badge, Divider } from "antd";
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, CameraOutlined, CheckCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import type { UploadFile } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";

interface S { id: string; code: string; status: string; _count?: { trackings: number; documents: number }; }
interface Trk { id: string; code: string; review: string | null; jpWeightKg: string | null; unitPriceVndPerKg: string | null; shipRateCurrency?: string | null; url: string | null; packedAt: string | null; docCapturedAt: string | null; vnTrackingCode: string | null; orderId: string | null; order?: { code: string; needsCheck?: boolean; checkNote?: string | null; customer?: { name: string } } | null; }
interface Order { id: string; code: string; customer?: { name: string }; }
interface Customer { id: string; name: string; }

// Apps Script dán vào file kho: kho gõ mã cột E -> gọi webhook -> quét ngay
const APPS_SCRIPT = (hookUrl: string) => `function onTrackingEdit(e) {
  if (!e || !e.range || e.range.getColumn() !== 5) return; // chỉ cột E (Mã TRACKING)
  UrlFetchApp.fetch("${hookUrl}", { method: "post", muteHttpExceptions: true });
}

// Chạy hàm này 1 lần để cài trigger (cấp quyền khi được hỏi)
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onTrackingEdit") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onTrackingEdit").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}`;

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [openT, setOpenT] = useState(false);
  const [openCons, setOpenCons] = useState(false);
  const [consCur, setConsCur] = useState<"VND" | "JPY">("VND");
  const [tForm] = Form.useForm();
  const [cForm] = Form.useForm();
  const [trkQ, setTrkQ] = useState("");
  const [revF, setRevF] = useState<"todo" | "done" | "all">("todo");
  const [statusF, setStatusF] = useState<string>("all");
  const [packF, setPackF] = useState<dayjs.Dayjs | null>(null);
  const [docF, setDocF] = useState<"all" | "todo" | "done">("all");
  const [loading, setLoading] = useState(false);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const shownTrks = useMemo(() => {
    const nq = norm(trkQ.trim());
    return trks.filter((t) => {
      if (revF === "todo" && t.review) return false;
      if (revF === "done" && !t.review) return false;
      if (statusF !== "all" && trkStatus(t).key !== statusF) return false;
      if (docF === "todo" && t.docCapturedAt) return false;
      if (docF === "done" && !t.docCapturedAt) return false;
      if (packF && (!t.packedAt || !dayjs(t.packedAt).isSame(packF, "day"))) return false;
      if (!nq) return true;
      return norm([t.code, t.order?.code, t.order?.customer?.name].filter(Boolean).join(" ")).includes(nq);
    });
  }, [trks, trkQ, revF, statusF, docF, packF]);
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
  const [hookUrl, setHookUrl] = useState("");
  const [openBulk, setOpenBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedTrk, setSelectedTrk] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = () => { setLoading(true); api.get<S[]>("/shipments").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  const loadTrk = () => api.get<Trk[]>("/trackings").then((r) => setTrks(r.data)).catch(() => {});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("rev") === "todo") setRevF("todo");
    if (q.get("doc") === "todo") { setDocF("todo"); setRevF("all"); }
    load(); loadTrk();
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    api.get<Customer[]>("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    if (can("system.manage_settings")) api.get<{ sheetUrl: string; hookUrl: string }>("/warehouse/pack-config").then((r) => { setKhoUrl(r.data.sheetUrl ?? ""); setHookUrl(r.data.hookUrl ?? ""); }).catch(() => {});
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
  async function saveCode(id: string, code: string) {
    try { await api.patch(`/trackings/${id}`, { code }); message.success("Đã lưu mã tracking"); loadTrk(); }
    catch { message.error("Lưu mã thất bại"); }
  }
  async function toggleDoc(t: Trk) {
    try { await api.patch(`/trackings/${t.id}`, { docCapturedAt: t.docCapturedAt ? null : new Date().toISOString() }); loadTrk(); }
    catch { message.error("Cập nhật chứng từ thất bại"); }
  }
  async function exportInvoice() {
    if (!selectedTrk.length) return;
    try {
      const r = await api.post<{ items: any[]; total: number; consignees: string[]; addresses: string[] }>("/trackings/invoice", { ids: selectedTrk });
      const d = r.data;
      const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
      const today = dayjs().format("DD/MM/YYYY");
      const invNo = "GB-" + dayjs().format("DDMMYY");
      const rows = d.items.map((it) => `<tr><td>${it.no}</td><td class=l>${esc(it.name)}</td><td>${esc(it.origin)}</td><td class=r>${it.unitPriceJpy.toLocaleString("ja-JP")}</td><td>${esc(it.unit)}</td><td class=r>${it.qty}</td><td class=r>${it.amount.toLocaleString("ja-JP")}</td></tr>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:24px}h1{text-align:center;letter-spacing:2px}
.hd{display:flex;justify-content:space-between;margin-bottom:12px}.hd div{line-height:1.5}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #333;padding:4px 6px;text-align:center}
td.l{text-align:left}td.r,th.r{text-align:right}tfoot td{font-weight:bold}
.btn{margin:12px 0}@media print{.btn{display:none}}</style></head><body>
<div class="btn"><button onclick="window.print()">In / Lưu PDF</button></div>
<h1>INVOICE</h1>
<div class="hd">
<div><b>SHIPPER:</b> GLOBAL CO.,LTD<br>ADD: TOKYOTO,TOSHIMAKU,KITAOTSUKA 2-10-1 UNIT 201<br>TEL: 03 68866872</div>
<div><b>Invoice No:</b> ${invNo}<br><b>DATE:</b> ${today}</div>
</div>
<div style="margin-bottom:8px"><b>CONSIGNEE:</b> ${esc(d.consignees.join(", ")) || "-"}<br>${esc(d.addresses.join("; "))}</div>
<table><thead><tr><th>Item No.</th><th>Item Name</th><th>Country of Origin</th><th class=r>Unit Price(JPY)</th><th>Unit</th><th class=r>Total QTY</th><th class=r>Total Amount(JPY)</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="6" class=r>TOTAL</td><td class=r>${d.total.toLocaleString("ja-JP")}</td></tr></tfoot></table>
</body></html>`;
      const w = window.open("", "_blank");
      if (!w) return message.error("Trình duyệt chặn cửa sổ, cho phép popup");
      w.document.write(html); w.document.close(); w.focus();
    } catch { message.error("Xuất hóa đơn thất bại"); }
  }
  async function bulkAssign() {
    const items = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [orderCode, ...rest] = l.split(/[\t,;]+|\s{2,}|\s+/);
      return { orderCode: (orderCode || "").trim(), code: (rest.join("") || "").trim() };
    }).filter((x) => x.orderCode && x.code);
    if (!items.length) return message.error("Dán mỗi dòng: mã đơn [tab/khoảng trắng] mã tracking");
    setBulkBusy(true);
    try {
      const r = await api.post<{ updated: number; created: number; notFound: string[] }>("/trackings/bulk", { items });
      message.success(`Gán ${r.data.updated + r.data.created} mã${r.data.notFound.length ? `, ${r.data.notFound.length} đơn không thấy` : ""}`);
      if (r.data.notFound.length) message.warning("Không thấy đơn: " + r.data.notFound.join(", "));
      setOpenBulk(false); setBulkText(""); loadTrk();
    } catch { message.error("Gán hàng loạt thất bại"); }
    finally { setBulkBusy(false); }
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
  async function addConsignment() {
    const v = await cForm.validateFields();
    const body = {
      customerId: v.customerId, code: v.code,
      vnWeightKg: v.vnWeightKg, unitPriceVndPerKg: v.unitPriceVndPerKg,
      shipRateCurrency: v.shipRateCurrency, exchangeRate: v.exchangeRate,
      review: v.review, packedAt: v.packedAt ? v.packedAt.format("YYYY-MM-DD") : undefined,
    };
    try { await api.post("/orders/consignment", body); message.success("Đã thêm hàng ký gửi"); setOpenCons(false); cForm.resetFields(); setConsCur("VND"); loadTrk(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Thêm ký gửi thất bại"); }
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
        extra={can("trackings.create") && <Space>
          <Button size="small" onClick={() => setOpenBulk(true)}>Dán nhiều mã</Button>
          {can("orders.create") && <Button size="small" onClick={() => setOpenCons(true)}>Thêm hàng ký gửi</Button>}
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setOpenT(true)}>Thêm tracking</Button>
        </Space>}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input.Search allowClear placeholder="Tìm mã tracking / đơn / khách" style={{ width: 300 }}
            value={trkQ} onChange={(e) => setTrkQ(e.target.value)} />
          <Segmented value={revF} onChange={(v) => setRevF(v as any)}
            options={[{ label: "Chưa đánh giá", value: "todo" }, { label: "Đã đánh giá", value: "done" }, { label: "Tất cả", value: "all" }]} />
          <Select value={statusF} onChange={setStatusF} style={{ width: 160 }}
            options={[{ value: "all", label: "Mọi tình trạng" }, { value: "new", label: "🔘 Mới" }, { value: "jp", label: "🔵 Kho Nhật" }, { value: "packed", label: "🟠 Đóng hàng về" }, { value: "vn", label: "🟢 Về kho VN" }]} />
          <DatePicker value={packF} onChange={setPackF} format="DD/MM/YYYY" placeholder="Ngày đóng (chuyến)" allowClear />
          <Segmented value={docF} onChange={(v) => setDocF(v as any)}
            options={[{ label: "CT: tất cả", value: "all" }, { label: "Chưa chụp", value: "todo" }, { label: "Đã chụp", value: "done" }]} />
          {selectedTrk.length > 0 && <Button type="primary" onClick={exportInvoice}>Xuất hóa đơn ({selectedTrk.length})</Button>}
        </Space>
        <style>{`.trk-compact .ant-table-thead>tr>th,.trk-compact .ant-table-tbody>tr>td{padding:3px 6px!important;font-size:12px}.trk-compact .ant-input-sm{font-size:12px;padding:1px 6px}`}</style>
        <Table
          className="trk-compact"
          rowKey="id" dataSource={shownTrks} size="small" pagination={{ pageSize: 30, showSizeChanger: true }}
          scroll={{ x: 940 }}
          rowSelection={{ selectedRowKeys: selectedTrk, onChange: (keys) => setSelectedTrk(keys as string[]) }}
          columns={[
            { title: "Khách", dataIndex: ["order", "customer", "name"], width: 84, ellipsis: true, render: (v) => v ?? "-" },
            { title: "Đơn", dataIndex: ["order", "code"], width: 64, render: (v) => v ?? "-" },
            { title: "Đóng về", dataIndex: "packedAt", width: 74, render: (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "-") },
            { title: "Tình trạng", width: 116, render: (_, t) => { const s = trkStatus(t); return (
              <Space direction="vertical" size={0}>
                <Badge color={s.color} text={<span style={{ fontSize: 12 }}>{s.label}</span>} />
                {t.order?.needsCheck && <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: "16px", padding: "0 4px" }} title={t.order?.checkNote ?? ""}>Gia cố/kiểm tra</Tag>}
              </Space>
            ); } },
            { title: "Link", dataIndex: "url", width: 38, align: "center",
              render: (v) => (v ? <a href={v} target="_blank" rel="noreferrer" title={v}>Xem</a> : "-") },
            { title: "CT", width: 40, align: "center",
              render: (_, t) => (
                <Button size="small" type="text" style={{ padding: 2 }}
                  icon={t.docCapturedAt ? <CheckCircleFilled style={{ color: "#16a34a" }} /> : <CameraOutlined style={{ color: "#94a3b8" }} />}
                  onClick={() => toggleDoc(t)}
                  title={t.docCapturedAt ? `Đã chụp ${new Date(t.docCapturedAt).toLocaleDateString("vi-VN")} - bấm để bỏ` : "Đánh dấu đã chụp chứng từ"} />
              ) },
            { title: "Mã tracking", dataIndex: "code", width: 124, render: (v, t) => (
              <Input defaultValue={v ?? ""} placeholder="Điền mã" size="small"
                onBlur={(e) => { if ((e.target.value || "") !== (v ?? "")) saveCode(t.id, e.target.value.trim()); }} />
            ) },
            {
              title: "Đánh giá", dataIndex: "review", width: 140,
              render: (v, t) => (
                <Input size="small" defaultValue={v ?? ""} placeholder="Đánh giá hàng"
                  onBlur={(e) => { if ((e.target.value || "") !== (v ?? "")) saveReview(t.id, e.target.value); }} />
              ),
            },
            { title: "Cân", dataIndex: "jpWeightKg", width: 44, render: (v) => (v ? Number(v) : "-") },
            { title: "Đ/kg", dataIndex: "unitPriceVndPerKg", width: 74, render: (v, t) => (v ? `${Number(v).toLocaleString("vi-VN")}${t.shipRateCurrency === "JPY" ? "¥" : "đ"}` : "-") },
            ...(can("trackings.delete") ? [{
              title: "", width: 36, fixed: "right" as const, render: (_: any, t: Trk) => (
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

      <Modal title="Thêm hàng ký gửi (chỉ vận chuyển)" open={openCons} onOk={addConsignment} onCancel={() => setOpenCons(false)} okText="Lưu">
        <p style={{ marginTop: 0, color: "#666" }}>Hàng khách tự đem / không mua qua mình. Chỉ tính tiền ship = cân × đơn giá/kg.</p>
        <Form form={cForm} layout="vertical" initialValues={{ shipRateCurrency: "VND", packedAt: dayjs() }}>
          <Form.Item name="customerId" label="Khách" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn khách"
              options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="code" label="Mã tracking" rules={[{ required: true }]}><Input placeholder="Mã vận đơn" /></Form.Item>
          <Form.Item name="vnWeightKg" label="Cân (kg)" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: "100%" }} /></Form.Item>
          <Space style={{ width: "100%" }} align="start">
            <Form.Item name="unitPriceVndPerKg" label="Đơn giá ship /kg" rules={[{ required: true }]}><InputNumber min={0} step={1000} style={{ width: 180 }} /></Form.Item>
            <Form.Item name="shipRateCurrency" label="Đơn vị">
              <Select style={{ width: 100 }} onChange={(v) => setConsCur(v)} options={[{ value: "VND", label: "VND/kg" }, { value: "JPY", label: "JPY/kg" }]} />
            </Form.Item>
          </Space>
          {consCur === "JPY" && <Form.Item name="exchangeRate" label="Tỉ giá (1¥ = ? đ)" rules={[{ required: true }]}><InputNumber min={0} step={1} style={{ width: "100%" }} /></Form.Item>}
          <Form.Item name="packedAt" label="Ngày đóng hàng về"><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="review" label="Ghi chú / đánh giá"><Input placeholder="(tùy chọn)" /></Form.Item>
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

      <Modal title="Dán nhiều mã tracking" open={openBulk} onOk={bulkAssign} confirmLoading={bulkBusy} onCancel={() => setOpenBulk(false)} okText="Gán" width={560}>
        <p style={{ marginTop: 0, color: "#666" }}>
          Mỗi dòng: <b>mã đơn</b> rồi <b>mã tracking</b> (cách nhau bằng Tab/khoảng trắng). Copy 2 cột từ Excel/Sheet dán vào đây.
        </p>
        <Input.TextArea rows={10} value={bulkText} onChange={(e) => setBulkText(e.target.value)}
          placeholder={"JA10017\t368149895794\nJA10018\t507712345678\nJA10019\t490472194343"} style={{ fontFamily: "monospace" }} />
      </Modal>

      <Modal title="Cài đặt file kho (bên đóng hàng)" open={openK} onOk={saveKhoCfg} onCancel={() => setOpenK(false)} okText="Lưu" width={680}>
        <p style={{ marginTop: 0, color: "#666" }}>
          Dán link Google Sheet của bên đóng hàng. File phải share quyền Xem cho service account.
          Cột E = mã tracking; ngày đóng lấy theo tên tab ("26.6" = 26/6). Hệ thống tự quét 2 phút/lần, mã trùng tracking sẽ chuyển 🟠 "Đóng hàng về".
        </p>
        <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={khoUrl} onChange={(e) => setKhoUrl(e.target.value)} />

        <Divider titlePlacement="start" style={{ marginTop: 20 }}>Cập nhật TỨC THÌ (tuỳ chọn) — Apps Script</Divider>
        <p style={{ marginTop: 0, color: "#666" }}>
          Muốn kho gõ mã là cam ngay (không đợi 2 phút): mở file kho → <b>Tiện ích mở rộng → Apps Script</b> → dán đoạn dưới → bấm <b>Lưu</b> → chạy hàm <b>setupTrigger</b> 1 lần (cấp quyền khi được hỏi).
        </p>
        <Input.TextArea readOnly rows={10} value={hookUrl ? APPS_SCRIPT(hookUrl) : ""} onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace", fontSize: 12 }} />
      </Modal>
    </PageContainer>
  );
}

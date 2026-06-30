import { useEffect, useState } from "react";
import { Card, Table, Form, InputNumber, Input, Button, Tag, Collapse, DatePicker, Modal, Space, App, Select, Empty } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";

interface BTrk {
  id: string; code: string; cartonId: string | null;
  jpWeightKg: string | null; vnWeightKg: string | null; vnTrackingCode: string | null; packedAt: string | null;
  order?: { code: string; customer?: { name: string } | null } | null;
}
interface BCarton { id: string; code: string; note: string | null; declaredWeightKg: number | null; actualKg: number; count: number; diffKg: number | null; trackings: BTrk[]; }
interface BDay { day: string; cartons: BCarton[]; unassigned: BTrk[]; }
interface Stock { id: string; code: string; packedAt: string | null; vnWeightKg: string | null; carton?: { code: string } | null; order?: { code: string; customer?: { name: string } | null } | null; }

type Edit = { vnWeightKg?: number | null; vnTrackingCode?: string };
const num = (v: string | null | undefined) => (v == null ? null : Number(v));
const NO_DAY = "0000-00-00";
const fmtDay = (d: string) => (d === NO_DAY ? "Chưa xếp ngày" : dayjs(d).format("DD/MM/YYYY"));
const fmtDate = (d: string | null) => (d ? dayjs(d).format("DD/MM/YYYY") : "-");

export default function Warehouse() {
  const { message } = App.useApp();
  const [board, setBoard] = useState<BDay[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [sel, setSel] = useState<Record<string, string[]>>({});      // unassigned chọn theo ngày
  const [target, setTarget] = useState<Record<string, string>>({});  // kiện đích theo ngày
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();

  const loadBoard = () => {
    setLoading(true);
    api.get<BDay[]>("/warehouse/vn-board").then((r) => { setBoard(r.data); setEdits({}); }).finally(() => setLoading(false));
  };
  const loadStock = () => api.get<Stock[]>("/trackings", { params: { stock: 1 } }).then((r) => setStock(r.data)).catch(() => {});
  useEffect(() => { loadBoard(); loadStock(); }, []);

  async function saveTrk(t: BTrk) {
    const e = edits[t.id] ?? {};
    const body: Record<string, unknown> = {};
    if (e.vnWeightKg !== undefined) { body.vnWeightKg = e.vnWeightKg ?? 0; body.status = "vn_weighed"; }
    if (e.vnTrackingCode !== undefined) body.vnTrackingCode = e.vnTrackingCode;
    if (Object.keys(body).length === 0) return message.info("Chưa thay đổi");
    try { await api.patch(`/trackings/${t.id}`, body); message.success("Đã lưu"); loadBoard(); loadStock(); }
    catch { message.error("Lưu thất bại"); }
  }

  async function createKi() {
    const v = await addForm.validateFields();
    try {
      await api.post("/control/cartons", {
        code: v.code,
        declaredWeightKg: v.declaredWeightKg ?? undefined,
        packedDate: v.packedDate ? v.packedDate.format("YYYY-MM-DD") : undefined,
        note: v.note || undefined,
      });
      message.success("Đã tạo kiện"); setAddOpen(false); addForm.resetFields(); loadBoard();
    } catch { message.error("Tạo kiện thất bại"); }
  }

  async function assignToKi(day: string) {
    const cartonId = target[day];
    const ids = sel[day] ?? [];
    if (!cartonId) return message.error("Chọn kiện đích");
    if (!ids.length) return message.info("Chọn tracking để gán");
    const codes = (board.find((d) => d.day === day)?.unassigned ?? []).filter((t) => ids.includes(t.id)).map((t) => t.code);
    try {
      const r = await api.post<{ assigned: number }>(`/control/cartons/${cartonId}/assign`, { codes });
      message.success(`Đã gán ${r.data.assigned} tracking vào kiện`);
      setSel((p) => ({ ...p, [day]: [] })); loadBoard();
    } catch { message.error("Gán thất bại"); }
  }

  async function detach(id: string) {
    try { await api.patch(`/trackings/${id}`, { cartonId: null }); loadBoard(); }
    catch { message.error("Bỏ khỏi kiện thất bại"); }
  }

  const trkCols = (detachable: boolean) => [
    { title: "Tracking", dataIndex: "code", width: 130 },
    { title: "Đơn", width: 90, render: (_: unknown, t: BTrk) => (t.order?.code ? <b>{t.order.code}</b> : <Tag color="warning">chưa gắn</Tag>) },
    { title: "Khách", width: 110, ellipsis: true, render: (_: unknown, t: BTrk) => t.order?.customer?.name ?? "-" },
    { title: "Cân JP", dataIndex: "jpWeightKg", width: 80, render: (v: string | null) => v ?? "-" },
    {
      title: "Cân VN (kg)", width: 140,
      render: (_: unknown, t: BTrk) => (
        <InputNumber min={0} step={0.001} style={{ width: 120 }} placeholder="nhập cân"
          value={edits[t.id]?.vnWeightKg !== undefined ? edits[t.id]!.vnWeightKg : num(t.vnWeightKg)}
          onChange={(val) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], vnWeightKg: val } }))}
          onPressEnter={() => saveTrk(t)} />
      ),
    },
    {
      title: "Tracking VN", width: 150,
      render: (_: unknown, t: BTrk) => (
        <Input style={{ width: 130 }} placeholder="-"
          value={edits[t.id]?.vnTrackingCode !== undefined ? edits[t.id]!.vnTrackingCode : (t.vnTrackingCode ?? "")}
          onChange={(e) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], vnTrackingCode: e.target.value } }))} />
      ),
    },
    {
      title: "", width: detachable ? 110 : 64,
      render: (_: unknown, t: BTrk) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => saveTrk(t)}>Lưu</Button>
          {detachable && <Button size="small" onClick={() => detach(t.id)}>Bỏ</Button>}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="Kho VN" sub="Hàng kho Nhật đóng về, chia theo ngày > kiện. Cân từng tracking, đối soát với cân tổng kho Nhật.">
      <Card
        title="Kho Nhật đóng về - đối soát theo kiện"
        extra={<Button icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>Tạo kiện</Button>}
      >
        {board.length === 0 ? (
          <Empty description={loading ? "Đang tải..." : "Chưa có hàng đóng về từ kho Nhật"} />
        ) : (
          <Collapse defaultActiveKey={board[0]?.day ? [board[0].day] : []}
            items={board.map((d) => ({
              key: d.day,
              label: <b>{fmtDay(d.day)} <span style={{ color: "#888", fontWeight: 400 }}>· {d.cartons.length} kiện · {d.unassigned.length} chưa gắn</span></b>,
              children: (
                <>
                  {d.cartons.map((c) => (
                    <Card key={c.id} size="small" style={{ marginBottom: 12 }} type="inner"
                      title={
                        <Space wrap>
                          <span>Kiện <b>{c.code}</b></span>
                          <Tag>Nhật: {c.declaredWeightKg != null ? `${c.declaredWeightKg} kg` : "chưa nhập"}</Tag>
                          <Tag color="blue">VN: {c.actualKg} kg</Tag>
                          {c.diffKg != null
                            ? (Math.abs(c.diffKg) > 0.1 ? <Tag color="error">lệch {c.diffKg > 0 ? "+" : ""}{c.diffKg}</Tag> : <Tag color="success">khớp</Tag>)
                            : null}
                        </Space>
                      }>
                      <Table rowKey="id" size="small" pagination={false} dataSource={c.trackings} scroll={{ x: 720 }}
                        columns={trkCols(true)} locale={{ emptyText: "Kiện trống - gán tracking ở dưới" }} />
                    </Card>
                  ))}

                  {d.unassigned.length > 0 && (
                    <Card size="small" type="inner" title={`Chưa gắn kiện (${d.unassigned.length})`}>
                      <Table rowKey="id" size="small" pagination={false} dataSource={d.unassigned} scroll={{ x: 720 }}
                        rowSelection={{ selectedRowKeys: sel[d.day] ?? [], onChange: (k) => setSel((p) => ({ ...p, [d.day]: k as string[] })) }}
                        columns={trkCols(false)} />
                      <Space style={{ marginTop: 8 }}>
                        <Select style={{ width: 200 }} placeholder="Chọn kiện đích" value={target[d.day]}
                          onChange={(v) => setTarget((p) => ({ ...p, [d.day]: v }))}
                          options={d.cartons.map((c) => ({ value: c.id, label: `Kiện ${c.code}` }))} />
                        <Button type="primary" onClick={() => assignToKi(d.day)}>Gán vào kiện</Button>
                        <Button onClick={() => { addForm.resetFields(); addForm.setFieldValue("packedDate", d.day !== NO_DAY ? dayjs(d.day) : undefined); setAddOpen(true); }}>+ Tạo kiện ngày này</Button>
                      </Space>
                    </Card>
                  )}
                </>
              ),
            }))} />
        )}
      </Card>

      <Card title={`Hàng tồn kho - chờ đóng đi VN (${stock.length})`} style={{ marginTop: 16 }}>
        <p style={{ marginTop: 0, color: "#666" }}>Hàng đã về kho nhưng chưa có tracking VN.</p>
        <Table rowKey="id" size="small" dataSource={stock} pagination={{ pageSize: 20 }}
          locale={{ emptyText: "Không có hàng tồn" }}
          columns={[
            { title: "Tracking", dataIndex: "code" },
            { title: "Kiện", render: (_, t: Stock) => t.carton?.code ? <b>{t.carton.code}</b> : <Tag>chưa xếp</Tag> },
            { title: "Ngày hàng về", render: (_, t: Stock) => fmtDate(t.packedAt) },
            { title: "Đơn", render: (_, t: Stock) => t.order?.code ?? <Tag color="warning">chưa gắn</Tag> },
            { title: "Khách", render: (_, t: Stock) => t.order?.customer?.name ?? "-" },
            { title: "Cân VN (kg)", dataIndex: "vnWeightKg", render: (v) => v ?? "-" },
          ]} />
      </Card>

      <Modal title="Tạo kiện kho Nhật" open={addOpen} onOk={createKi} onCancel={() => setAddOpen(false)} okText="Tạo kiện">
        <Form form={addForm} layout="vertical">
          <Form.Item name="code" label="Mã kiện" rules={[{ required: true }]} tooltip="Tên kiện kho Nhật, vd A1">
            <Input placeholder="vd: A1" />
          </Form.Item>
          <Form.Item name="declaredWeightKg" label="Cân tổng kho Nhật (kg)">
            <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="packedDate" label="Ngày kho Nhật đóng" tooltip="Để gom kiện vào đúng ngày">
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

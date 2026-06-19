import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tag, App } from "antd";
import { api } from "../api";

interface T { id: string; code: string; jpName: string | null; jpPriceJpy: string | null; jpWeightKg: string | null; shipmentId: string | null; status: string; }
interface Shipment { id: string; code: string; }

export default function WarehouseJp() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<T | null>(null);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); api.get<T[]>("/trackings").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    api.get<Shipment[]>("/shipments").then((r) => setShipments(r.data)).catch(() => {});
  }, []);

  function openEdit(t: T) {
    setEdit(t);
    form.setFieldsValue({
      jpName: t.jpName, jpPriceJpy: t.jpPriceJpy ? Number(t.jpPriceJpy) : undefined,
      jpWeightKg: t.jpWeightKg ? Number(t.jpWeightKg) : undefined, shipmentId: t.shipmentId ?? undefined,
    });
  }

  async function save() {
    const v = await form.validateFields();
    try { await api.patch(`/trackings/${edit!.id}`, { ...v, status: "weighed" }); message.success("Đã cập nhật"); setEdit(null); load(); }
    catch { message.error("Cập nhật thất bại"); }
  }

  return (
    <Card title="Kho Nhật — Quét tracking, cân, gán chuyến">
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="middle"
        columns={[
          { title: "Mã", dataIndex: "code" },
          { title: "Tên JP", dataIndex: "jpName" },
          { title: "Giá ¥", dataIndex: "jpPriceJpy" },
          { title: "Cân (kg)", dataIndex: "jpWeightKg" },
          { title: "Chuyến", dataIndex: "shipmentId", render: (v) => (v ? <Tag color="green">đã gán</Tag> : <Tag>chưa</Tag>) },
          { title: "", render: (_, t) => <Button size="small" type="primary" onClick={() => openEdit(t)}>Cập nhật</Button> },
        ]}
      />
      <Modal title={`Tracking ${edit?.code}`} open={!!edit} onOk={save} onCancel={() => setEdit(null)} okText="Lưu">
        <Form form={form} layout="vertical">
          <Form.Item name="jpName" label="Tên hàng (JP)"><Input /></Form.Item>
          <Form.Item name="jpPriceJpy" label="Giá ¥"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="jpWeightKg" label="Cân (kg)"><InputNumber min={0} step={0.001} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="shipmentId" label="Gán chuyến">
            <Select allowClear showSearch optionFilterProp="label" options={shipments.map((s) => ({ value: s.id, label: s.code }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

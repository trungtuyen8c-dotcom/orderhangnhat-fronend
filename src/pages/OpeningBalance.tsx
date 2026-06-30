import { useEffect, useMemo, useState } from "react";
import { Card, Table, InputNumber, Select, Input, Button, Tag, App } from "antd";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";
import { PageContainer } from "../components/PageContainer";
import { vnd } from "../lib/status";

interface Customer { id: string; code?: string | null; name: string; }
interface Opening { customerId: string; amountOrig: number; currency: string; exchangeRate: number | null; amountVnd: number; }
type Row = { amount: number | null; currency: "VND" | "JPY"; exchangeRate: number | null };

export default function OpeningBalance() {
  const { message } = App.useApp();
  const { can } = usePermission();
  const editable = can("accounting.record_payment");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const [c, o] = await Promise.all([
      api.get<Customer[]>("/customers"),
      api.get<Opening[]>("/accounting/opening-balances"),
    ]);
    setCustomers(c.data);
    const m: Record<string, Row> = {};
    for (const x of o.data) m[x.customerId] = { amount: x.amountOrig, currency: x.currency as "VND" | "JPY", exchangeRate: x.exchangeRate };
    setRows(m);
  };
  useEffect(() => { load(); }, []);

  const row = (id: string): Row => rows[id] ?? { amount: null, currency: "VND", exchangeRate: null };
  const set = (id: string, patch: Partial<Row>) => setRows((p) => ({ ...p, [id]: { ...row(id), ...patch } }));
  const toVnd = (r: Row) => (r.amount == null ? 0 : r.currency === "JPY" ? Math.round(r.amount * (r.exchangeRate ?? 0)) : r.amount);

  async function save(id: string) {
    const r = row(id);
    if (r.amount == null) return message.info("Chưa nhập số dư");
    if (r.currency === "JPY" && !r.exchangeRate) return message.error("Đầu kỳ JPY cần nhập tỉ giá");
    setSaving(id);
    try {
      await api.put(`/accounting/customers/${id}/opening-balance`, { amount: r.amount, currency: r.currency, exchangeRate: r.exchangeRate ?? undefined });
      message.success("Đã lưu số dư đầu kỳ");
    } catch { message.error("Lưu thất bại"); } finally { setSaving(null); }
  }

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return customers;
    return customers.filter((c) => [c.name, c.code].some((x) => (x ?? "").toLowerCase().includes(kw)));
  }, [customers, q]);

  return (
    <PageContainer title="Số dư đầu kỳ" sub="Chốt số dư mỗi khách tại 30/6 trước khi dùng hệ thống. Dương = khách còn tiền (cọc dư), âm = khách đang nợ. Có VND và JPY.">
      <Card extra={<Input.Search allowClear placeholder="Tìm khách" style={{ width: 240 }} value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table rowKey="id" dataSource={shown} size="middle" pagination={{ pageSize: 30 }}
          columns={[
            { title: "Khách", render: (_, c: Customer) => <span>{c.name}{c.code ? <Tag style={{ marginLeft: 6 }}>{c.code}</Tag> : null}</span> },
            {
              title: "Số dư đầu kỳ", width: 180,
              render: (_, c: Customer) => (
                <InputNumber style={{ width: 160 }} step={1000} disabled={!editable} placeholder="dương=dư, âm=nợ"
                  value={row(c.id).amount}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => Number((v ?? "").replace(/,/g, ""))}
                  onChange={(v) => set(c.id, { amount: v })} />
              ),
            },
            {
              title: "Tiền tệ", width: 100,
              render: (_, c: Customer) => (
                <Select style={{ width: 84 }} disabled={!editable} value={row(c.id).currency}
                  onChange={(v) => set(c.id, { currency: v })} options={[{ value: "VND", label: "VND" }, { value: "JPY", label: "JPY" }]} />
              ),
            },
            {
              title: "Tỉ giá (JPY)", width: 120,
              render: (_, c: Customer) => row(c.id).currency === "JPY" ? (
                <InputNumber style={{ width: 100 }} min={0} step={1} disabled={!editable} placeholder="vd 175"
                  value={row(c.id).exchangeRate} onChange={(v) => set(c.id, { exchangeRate: v })} />
              ) : <span style={{ color: "#bbb" }}>-</span>,
            },
            { title: "Quy ra VND", width: 140, render: (_, c: Customer) => { const v = toVnd(row(c.id)); return <b style={{ color: v < 0 ? "#dc2626" : v > 0 ? "#16a34a" : undefined }}>{vnd(v)}</b>; } },
            ...(editable ? [{ title: "", width: 80, render: (_: unknown, c: Customer) => <Button size="small" type="primary" loading={saving === c.id} onClick={() => save(c.id)}>Lưu</Button> }] : []),
          ]} />
      </Card>
    </PageContainer>
  );
}

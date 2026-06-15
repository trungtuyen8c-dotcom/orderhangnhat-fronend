import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";

interface Order { id: string; code: string; }
interface Recon { id: string; orderId: string; jpWeight: string | null; vnWeight: string | null; diffKg: string | null; note: string | null; }

export default function Warehouse() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [rows, setRows] = useState<Recon[]>([]);
  const [form, setForm] = useState({ orderId: "", vnWeight: 0, note: "" });
  const [err, setErr] = useState("");

  const load = () => api.get<Recon[]>("/warehouse/recon").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await api.post("/warehouse/vn-weight", { orderId: form.orderId, vnWeight: Number(form.vnWeight), note: form.note || undefined }); setForm({ orderId: "", vnWeight: 0, note: "" }); load(); }
    catch { setErr("Ghi cân thất bại"); }
  }

  return (
    <div>
      <h2>Kho VN — Đối soát chênh cân</h2>
      {err && <p className="err">{err}</p>}
      <form className="panel" onSubmit={submit}>
        <div className="row">
          <select value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} required>
            <option value="">-- Chọn đơn --</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
          </select>
          <input type="number" step="0.001" placeholder="Cân VN (kg)" value={form.vnWeight} onChange={(e) => setForm({ ...form, vnWeight: Number(e.target.value) })} />
          <input placeholder="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="btn" type="submit">Ghi cân + đối soát</button>
        </div>
      </form>
      <table>
        <thead><tr><th>Đơn</th><th>Cân JP</th><th>Cân VN</th><th>Chênh (kg)</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.orderId.slice(0, 8)}</td><td>{r.jpWeight}</td><td>{r.vnWeight}</td>
              <td style={{ color: Number(r.diffKg) !== 0 ? "#dc2626" : undefined }}>{r.diffKg}</td><td>{r.note}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>Chưa có dữ liệu</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface T { id: string; code: string; orderId: string | null; jpName: string | null; jpWeightKg: string | null; status: string; }
interface Order { id: string; code: string; }

export default function Tracking() {
  const { can } = usePermission();
  const [rows, setRows] = useState<T[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ code: "", orderId: "", jpName: "", jpPriceJpy: 0 });
  const [err, setErr] = useState("");

  const load = () => api.get<T[]>("/trackings").then((r) => setRows(r.data)).catch(() => setErr("Không tải được"));
  useEffect(() => {
    load();
    if (can("orders.list")) api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr("");
    try {
      await api.post("/trackings", { code: form.code, orderId: form.orderId || undefined, jpName: form.jpName || undefined, jpPriceJpy: Number(form.jpPriceJpy) || undefined });
      setForm({ code: "", orderId: "", jpName: "", jpPriceJpy: 0 }); load();
    } catch { setErr("Tạo tracking thất bại"); }
  }

  async function resolve(id: string) {
    const reason = prompt("Lý do xử lý tracking lạ:");
    if (!reason) return;
    const orderId = prompt("Gán vào orderId (để trống = giữ nguyên):") || undefined;
    try { await api.post(`/trackings/${id}/resolve`, { reason, orderId }); load(); }
    catch { setErr("Resolve thất bại"); }
  }

  return (
    <div>
      <h2>Tracking</h2>
      {err && <p className="err">{err}</p>}
      {can("trackings.create") && (
        <form className="panel" onSubmit={create}>
          <div className="row">
            <input placeholder="Mã tracking *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <select value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}>
              <option value="">-- Gán đơn (tùy chọn) --</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
            <input placeholder="Tên (JP)" value={form.jpName} onChange={(e) => setForm({ ...form, jpName: e.target.value })} />
            <input type="number" placeholder="Giá ¥" value={form.jpPriceJpy} onChange={(e) => setForm({ ...form, jpPriceJpy: Number(e.target.value) })} />
            <button className="btn" type="submit">Thêm tracking</button>
          </div>
        </form>
      )}
      <table>
        <thead><tr><th>Mã</th><th>Đơn</th><th>Tên JP</th><th>Cân (kg)</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.code}</td><td>{t.orderId ? "✓" : "—"}</td><td>{t.jpName}</td><td>{t.jpWeightKg ?? "-"}</td>
              <td><span className="badge">{t.status}</span></td>
              <td>{can("trackings.resolve") && <button className="btn sm gray" onClick={() => resolve(t.id)}>Xử lý lạ</button>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6}>Chưa có tracking</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

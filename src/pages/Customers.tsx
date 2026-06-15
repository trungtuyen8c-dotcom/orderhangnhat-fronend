import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface Customer {
  id: string;
  name: string;
  fbZalo?: string | null;
  phone?: string | null;
  note?: string | null;
}

export default function Customers() {
  const { can } = usePermission();
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", fbZalo: "", phone: "", note: "" });
  const [err, setErr] = useState("");

  const load = () => api.get<Customer[]>("/customers").then((r) => setRows(r.data)).catch(() => setErr("Không tải được"));
  useEffect(() => { load(); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/customers", form);
      setForm({ name: "", fbZalo: "", phone: "", note: "" });
      load();
    } catch {
      setErr("Tạo khách thất bại");
    }
  }

  return (
    <div>
      <h2>Khách hàng</h2>
      {err && <p className="err">{err}</p>}
      {can("customers.create") && (
        <form className="panel" onSubmit={onSubmit}>
          <div className="row">
            <input placeholder="Tên *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="FB/Zalo" value={form.fbZalo} onChange={(e) => setForm({ ...form, fbZalo: e.target.value })} />
            <input placeholder="SĐT" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button className="btn" type="submit">Thêm khách</button>
          </div>
        </form>
      )}
      <table>
        <thead><tr><th>Tên</th><th>FB/Zalo</th><th>SĐT</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td>{c.fbZalo}</td><td>{c.phone}</td><td>{c.note}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4}>Chưa có khách</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

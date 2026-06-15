import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface S { id: string; code: string; status: string; _count?: { trackings: number; documents: number }; }

const DOC_TYPES = ["invoice", "packing", "ingredient", "purchase_invoice", "tax"];

export default function Shipments() {
  const { can } = usePermission();
  const [rows, setRows] = useState<S[]>([]);
  const [code, setCode] = useState("");
  const [doc, setDoc] = useState({ type: "invoice", shipmentId: "", file: null as File | null });
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");

  const load = () => api.get<S[]>("/shipments").then((r) => setRows(r.data)).catch(() => setErr("Không tải được"));
  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await api.post("/shipments", { code }); setCode(""); load(); }
    catch { setErr("Tạo chuyến thất bại"); }
  }

  async function upload(e: FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    if (!doc.file) return;
    const fd = new FormData();
    fd.append("file", doc.file); fd.append("type", doc.type);
    if (doc.shipmentId) fd.append("shipmentId", doc.shipmentId);
    try { await api.post("/shipments/documents", fd); setMsg("Đã tải chứng từ"); load(); }
    catch { setErr("Upload thất bại"); }
  }

  return (
    <div>
      <h2>Chuyến & Chứng từ</h2>
      {err && <p className="err">{err}</p>}
      {msg && <p style={{ color: "green" }}>{msg}</p>}
      {can("shipments.create") && (
        <form className="panel" onSubmit={create}>
          <div className="row">
            <input placeholder="Mã chuyến *" value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="btn" type="submit">Tạo chuyến</button>
          </div>
        </form>
      )}
      {can("shipments.upload_doc") && (
        <form className="panel" onSubmit={upload}>
          <div className="row">
            <select value={doc.type} onChange={(e) => setDoc({ ...doc, type: e.target.value })}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={doc.shipmentId} onChange={(e) => setDoc({ ...doc, shipmentId: e.target.value })}>
              <option value="">-- Chuyến (tùy chọn) --</option>
              {rows.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
            <input type="file" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] ?? null })} />
            <button className="btn" type="submit">Tải chứng từ GA</button>
          </div>
        </form>
      )}
      <table>
        <thead><tr><th>Mã chuyến</th><th>Trạng thái</th><th>Tracking</th><th>Chứng từ</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}><td>{s.code}</td><td><span className="badge">{s.status}</span></td><td>{s._count?.trackings ?? 0}</td><td>{s._count?.documents ?? 0}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4}>Chưa có chuyến</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

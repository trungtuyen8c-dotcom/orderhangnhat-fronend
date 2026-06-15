import { useEffect, useState } from "react";

import { api } from "../api";

interface Stats {
  totalOrders: number;
  customers: number;
  byStatus: { status: string; count: number }[];
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setS(r.data)).catch(() => setErr("Không tải được số liệu"));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      {err && <p className="err">{err}</p>}
      <div className="cards">
        <div className="card"><div className="num">{s?.totalOrders ?? "-"}</div><div className="label">Tổng đơn</div></div>
        <div className="card"><div className="num">{s?.customers ?? "-"}</div><div className="label">Khách hàng</div></div>
      </div>
      <h3>Đơn theo trạng thái</h3>
      <table>
        <thead><tr><th>Trạng thái</th><th>Số lượng</th></tr></thead>
        <tbody>
          {(s?.byStatus ?? []).map((b) => (
            <tr key={b.status}><td>{b.status}</td><td>{b.count}</td></tr>
          ))}
          {s && s.byStatus.length === 0 && <tr><td colSpan={2}>Chưa có đơn</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface Order {
  id: string;
  code: string;
  status: string;
  totalQuote: string | null;
  customer?: { name: string };
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => setErr("Không tải được"));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <Link to="/">← Dashboard</Link>
      <h2>Đơn hàng</h2>
      {err && <p style={{ color: "red" }}>{err}</p>}
      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead><tr><th>Mã</th><th>Khách</th><th>Trạng thái</th><th>Báo giá (¥)</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.code}</td><td>{o.customer?.name}</td><td>{o.status}</td><td>{o.totalQuote ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

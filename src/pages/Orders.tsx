import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface Order {
  id: string;
  code: string;
  status: string;
  totalQuote: string | null;
  customer?: { name: string };
}
interface Customer { id: string; name: string; }
interface Item { name: string; qty: number; unitPriceJpy: number; }

const NEXT: Record<string, string[]> = {
  draft: ["quoted", "closed"], quoted: ["deposited", "closed"],
  deposited: ["purchasing", "cancelled"], purchasing: ["purchased", "cancelled"],
  purchased: ["jp_warehouse"], jp_warehouse: ["customs"], customs: ["tax_done"],
  tax_done: ["vn_warehouse"], vn_warehouse: ["delivered"], delivered: ["completed"],
};

export default function Orders() {
  const { can } = usePermission();
  const [rows, setRows] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<Item[]>([{ name: "", qty: 1, unitPriceJpy: 0 }]);
  const [err, setErr] = useState("");

  const load = () => api.get<Order[]>("/orders").then((r) => setRows(r.data)).catch(() => setErr("Không tải được đơn"));
  useEffect(() => {
    load();
    if (can("customers.list")) api.get<Customer[]>("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  function setItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/orders", { customerId, items: items.filter((i) => i.name) });
      setItems([{ name: "", qty: 1, unitPriceJpy: 0 }]);
      setCustomerId("");
      load();
    } catch {
      setErr("Tạo đơn thất bại (chọn khách + ít nhất 1 món)");
    }
  }

  async function changeStatus(id: string, status: string) {
    try { await api.patch(`/orders/${id}/status`, { status }); load(); }
    catch { setErr("Chuyển trạng thái không hợp lệ"); }
  }

  return (
    <div>
      <h2>Đơn hàng</h2>
      {err && <p className="err">{err}</p>}

      {can("orders.create") && (
        <form className="panel" onSubmit={createOrder}>
          <div className="row">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">-- Chọn khách --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {items.map((it, i) => (
            <div className="row" key={i}>
              <input placeholder="Tên món" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
              <input type="number" min={1} style={{ width: 70 }} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
              <input type="number" min={0} placeholder="Giá ¥" value={it.unitPriceJpy} onChange={(e) => setItem(i, { unitPriceJpy: Number(e.target.value) })} />
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn gray sm" onClick={() => setItems([...items, { name: "", qty: 1, unitPriceJpy: 0 }])}>+ Thêm món</button>
            <button type="submit" className="btn">Tạo đơn</button>
          </div>
        </form>
      )}

      <table>
        <thead><tr><th>Mã</th><th>Khách</th><th>Trạng thái</th><th>Báo giá (¥)</th><th>Hành động</th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.code}</td>
              <td>{o.customer?.name}</td>
              <td><span className="badge">{o.status}</span></td>
              <td>{o.totalQuote ?? "-"}</td>
              <td>
                {can("orders.update_status") && (NEXT[o.status] ?? []).map((ns) => (
                  <button key={ns} className="btn sm" style={{ marginRight: 4 }} onClick={() => changeStatus(o.id, ns)}>{ns}</button>
                ))}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>Chưa có đơn</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

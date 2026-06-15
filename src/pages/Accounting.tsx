import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";

interface Order { id: string; code: string; status: string; totalQuote: string | null; }
interface Wallet { id: string; name: string; balance: string; }
interface Txn { id: string; amount: string; type: string; reconciled: boolean; wallet?: { name: string }; }
interface Payment { id: string; type: string; amountVnd: string; createdAt: string; }
interface Debt { balance: string; }

export default function Accounting() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [sel, setSel] = useState("");
  const [pay, setPay] = useState({ type: "deposit", amountVnd: 0, walletId: "" });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [err, setErr] = useState("");

  const loadRecon = () => api.get<Txn[]>("/accounting/reconcile").then((r) => setTxns(r.data)).catch(() => {});
  useEffect(() => {
    api.get<Order[]>("/orders").then((r) => setOrders(r.data)).catch(() => {});
    api.get<Wallet[]>("/accounting/wallets").then((r) => setWallets(r.data)).catch(() => {});
    loadRecon();
  }, []);

  function selectOrder(id: string) {
    setSel(id);
    if (id) api.get<{ payments: Payment[]; debt: Debt | null }>(`/accounting/orders/${id}/payments`).then((r) => { setPayments(r.data.payments); setDebt(r.data.debt); }).catch(() => {});
  }

  async function record(e: FormEvent) {
    e.preventDefault(); setErr("");
    try {
      await api.post(`/accounting/orders/${sel}/payments`, { type: pay.type, amountVnd: Number(pay.amountVnd), walletId: pay.walletId || undefined });
      setPay({ type: "deposit", amountVnd: 0, walletId: "" }); selectOrder(sel); loadRecon();
    } catch { setErr("Ghi tiền thất bại"); }
  }

  async function reconcile(id: string) {
    const ref = prompt("Mã sao kê (statement ref):") || undefined;
    try { await api.post(`/accounting/wallet-txns/${id}/reconcile`, { statementRef: ref }); loadRecon(); }
    catch { setErr("Đối soát thất bại"); }
  }

  return (
    <div>
      <h2>Kế toán</h2>
      {err && <p className="err">{err}</p>}

      <div className="cards">
        {wallets.map((w) => (
          <div className="card" key={w.id}><div className="num">{Number(w.balance).toLocaleString()}</div><div className="label">{w.name}</div></div>
        ))}
      </div>

      <div className="panel">
        <h3>Ghi cọc / thu nốt / hoàn</h3>
        <form onSubmit={record}>
          <div className="row">
            <select value={sel} onChange={(e) => selectOrder(e.target.value)} required>
              <option value="">-- Chọn đơn --</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code} ({o.status})</option>)}
            </select>
            <select value={pay.type} onChange={(e) => setPay({ ...pay, type: e.target.value })}>
              <option value="deposit">Cọc</option><option value="final">Thu nốt</option><option value="refund">Hoàn</option>
            </select>
            <input type="number" placeholder="Số tiền (VND)" value={pay.amountVnd} onChange={(e) => setPay({ ...pay, amountVnd: Number(e.target.value) })} />
            <select value={pay.walletId} onChange={(e) => setPay({ ...pay, walletId: e.target.value })}>
              <option value="">-- Ví (tùy chọn) --</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button className="btn" type="submit" disabled={!sel}>Ghi</button>
          </div>
        </form>
        {sel && (
          <p>Công nợ còn lại: <b>{debt ? Number(debt.balance).toLocaleString() : "-"}</b> VND — Lịch sử: {payments.map((p) => `${p.type} ${Number(p.amountVnd).toLocaleString()}`).join(", ") || "chưa có"}</p>
        )}
      </div>

      <h3>Đối soát ví (giao dịch chưa đối soát)</h3>
      <table>
        <thead><tr><th>Ví</th><th>Số tiền</th><th>Loại</th><th></th></tr></thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id}><td>{t.wallet?.name}</td><td>{Number(t.amount).toLocaleString()}</td><td>{t.type}</td>
              <td><button className="btn sm" onClick={() => reconcile(t.id)}>Đối soát</button></td></tr>
          ))}
          {txns.length === 0 && <tr><td colSpan={4}>Không có giao dịch chờ</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

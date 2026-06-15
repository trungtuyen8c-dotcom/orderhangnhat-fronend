import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { usePermission } from "../hooks/usePermission";

interface User { id: string; email: string; fullName: string | null; isActive: boolean; roles: string[]; }
interface Role { key: string; name: string; }
interface Audit { id: string; actorId: string | null; action: string; createdAt: string; }

export default function Admin() {
  const { can } = usePermission();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", roleKeys: [] as string[] });
  const [err, setErr] = useState("");

  const loadUsers = () => api.get<User[]>("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => {
    loadUsers();
    api.get<Role[]>("/admin/roles").then((r) => setRoles(r.data)).catch(() => {});
    if (can("system.view_audit_log")) api.get<Audit[]>("/admin/audit?limit=50").then((r) => setAudit(r.data)).catch(() => {});
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await api.post("/admin/users", form); setForm({ email: "", password: "", fullName: "", roleKeys: [] }); loadUsers(); }
    catch { setErr("Tạo user thất bại (email trùng?)"); }
  }

  async function assign(u: User) {
    const input = prompt(`Vai trò cho ${u.email} (cách nhau dấu phẩy):`, u.roles.join(","));
    if (input === null) return;
    const roleKeys = input.split(",").map((s) => s.trim()).filter(Boolean);
    try { await api.post(`/admin/users/${u.id}/roles`, { roleKeys }); loadUsers(); }
    catch { setErr("Gán vai trò thất bại"); }
  }

  return (
    <div>
      <h2>Quản trị — Users / Roles / Audit</h2>
      {err && <p className="err">{err}</p>}

      {can("users.create") && (
        <form className="panel" onSubmit={createUser}>
          <div className="row">
            <input placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input placeholder="Mật khẩu *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <input placeholder="Tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <select multiple value={form.roleKeys} onChange={(e) => setForm({ ...form, roleKeys: Array.from(e.target.selectedOptions).map((o) => o.value) })} style={{ minWidth: 160, height: 90 }}>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
            <button className="btn" type="submit">Tạo user</button>
          </div>
        </form>
      )}

      <h3>Người dùng</h3>
      <table>
        <thead><tr><th>Email</th><th>Tên</th><th>Vai trò</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.email}</td><td>{u.fullName}</td><td>{u.roles.join(", ")}</td>
              <td>{can("roles.assign") && <button className="btn sm" onClick={() => assign(u)}>Gán vai trò</button>}</td></tr>
          ))}
        </tbody>
      </table>

      {can("system.view_audit_log") && (
        <>
          <h3 style={{ marginTop: 24 }}>Audit log (50 gần nhất)</h3>
          <table>
            <thead><tr><th>Thời gian</th><th>Actor</th><th>Hành động</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.actorId?.slice(0, 8) ?? "-"}</td><td>{a.action}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

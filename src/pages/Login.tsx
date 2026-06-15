import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@orderhn.local");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/");
    } catch {
      setErr("Sai email hoặc mật khẩu");
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: "80px auto", fontFamily: "system-ui" }}>
      <h2>Đăng nhập</h2>
      <form onSubmit={onSubmit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          style={{ width: "100%", padding: 8, marginBottom: 8 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mật khẩu"
          style={{ width: "100%", padding: 8, marginBottom: 8 }} />
        {err && <p style={{ color: "red" }}>{err}</p>}
        <button type="submit" style={{ width: "100%", padding: 8 }}>Đăng nhập</button>
      </form>
    </div>
  );
}

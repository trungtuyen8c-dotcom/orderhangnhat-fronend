import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken } from "./api";

export interface Me {
  id: string;
  email: string;
  fullName?: string;
  roles: string[];
  permissions: string[];
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    try {
      const res = await api.get<Me>("/me");
      setMe(res.data);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    // thử renew khi mở app (refresh cookie còn hạn)
    (async () => {
      try {
        const r = await api.post("/auth/renew");
        setAccessToken(r.data.accessToken);
        await loadMe();
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    await loadMe();
  }

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setAccessToken(null);
    setMe(null);
  }

  return <Ctx.Provider value={{ me, loading, login, logout }}>{children}</Ctx.Provider>;
}

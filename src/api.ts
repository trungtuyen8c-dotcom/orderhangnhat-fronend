import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

// Access token giữ trong memory (không localStorage)
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export const api = axios.create({ baseURL: BASE, withCredentials: true });

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// Single-flight renew khi 401
let renewing: Promise<string | null> | null = null;

async function renew(): Promise<string | null> {
  try {
    const res = await axios.post(`${BASE}/auth/renew`, {}, { withCredentials: true });
    const t = res.data.accessToken as string;
    setAccessToken(t);
    return t;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      renewing = renewing ?? renew();
      const t = await renewing;
      renewing = null;
      if (t) {
        original.headers.Authorization = `Bearer ${t}`;
        return api(original);
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

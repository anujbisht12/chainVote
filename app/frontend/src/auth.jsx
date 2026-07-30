import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // No localStorage check here — we always just ask the server "who am
  // I?" and let the httpOnly cookie (if any) answer that. If there's no
  // valid session, /auth/me returns 401 and we simply treat the user as
  // logged out.
  const bootstrap = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (_) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail, "Login failed") };
    }
  };

  // publicKeyPem is generated client-side (see lib/voteCrypto.js) by the
  // caller (Register.jsx) BEFORE this function is invoked. This function
  // never sees or handles a private key.
  const register = async (name, email, password, publicKeyPem) => {
    try {
      const { data } = await api.post("/auth/register", {
        name,
        email,
        password,
        public_key: publicKeyPem,
      });
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail, "Registration failed") };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }

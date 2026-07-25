import { useState } from "react";

import { useAuth } from "../auth";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const res = await login(form.email, form.password);
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    nav(res.user.role === "admin" ? "/admin" : "/dashboard");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="login-page">
      <div className="max-w-md w-full card-tech p-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">SIGN IN</div>
        <h1 className="text-3xl text-white tracking-tight mb-8">Welcome back</h1>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] block mb-2">Email</span>
            <input data-testid="login-email" type="email" required value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-tech"/>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] block mb-2">Password</span>
            <input data-testid="login-password" type="password" required value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="input-tech"/>
          </label>
          {err && <div data-testid="login-error" className="text-sm text-[var(--red)] border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">{err}</div>}
          <button data-testid="login-submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-6 text-sm text-[var(--text-dim)]">
          New here? <Link to="/register" className="text-[var(--cyan)] hover:underline">Create voter account</Link>
        </div>
      </div>
    </div>
  );
}
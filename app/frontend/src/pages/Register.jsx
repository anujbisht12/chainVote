import { useState } from "react";

import { useAuth } from "../auth";
import { useNavigate, Link } from "react-router-dom";
import { KeyRound, Download, Copy, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await register(form.name, form.email, form.password);
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    setPrivateKey(res.privateKey);
  };

  const download = () => {
    const blob = new Blob([privateKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chainvote-private-key-${form.email}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (privateKey) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="register-key-page">
        <div className="max-w-2xl w-full card-tech p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 border border-[var(--cyan)] text-[var(--cyan)] flex items-center justify-center"><KeyRound size={18}/></div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--cyan)]">STEP 2 / 2</div>
              <h1 className="text-2xl text-white tracking-tight">Your voter private key</h1>
            </div>
          </div>

          <div className="border border-[var(--yellow)]/40 bg-[var(--yellow)]/5 p-4 flex gap-3 mb-6">
            <AlertTriangle size={18} className="text-[var(--yellow)] shrink-0 mt-0.5"/>
            <div className="text-sm text-white">
              <div className="font-semibold text-[var(--yellow)] mb-1">SHOWN ONCE — SAVE IT NOW</div>
              This private key is the ONLY way to sign your ballot. Without it, you cannot vote. It is never stored in plaintext on our servers.
            </div>
          </div>

          <textarea
            data-testid="private-key-textarea"
            readOnly
            value={privateKey}
            className="input-tech font-mono text-xs h-64 resize-none"
          />

          <div className="flex flex-wrap gap-3 mt-6">
            <button data-testid="download-key-btn" className="btn-primary inline-flex items-center gap-2" onClick={download}>
              <Download size={14}/> Download .pem
            </button>
            <button data-testid="copy-key-btn" className="btn-ghost inline-flex items-center gap-2" onClick={copy}>
              {copied ? <CheckCircle2 size={14} className="text-[var(--cyan)]"/> : <Copy size={14}/>}
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button data-testid="continue-btn" className="btn-ghost ml-auto" onClick={() => nav("/dashboard")}>
              I've saved it, continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="register-page">
      <div className="max-w-md w-full card-tech p-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">STEP 1 / 2</div>
        <h1 className="text-3xl text-white tracking-tight mb-2">Register to vote</h1>
        <p className="text-sm text-[var(--text-dim)] mb-8">Create an account. We'll generate your RSA-2048 keypair.</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" testid="register-name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required minLength={2}/>
          <Field label="Email" type="email" testid="register-email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required/>
          <Field label="Password" type="password" testid="register-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required minLength={6}/>

          {err && <div data-testid="register-error" className="text-sm text-[var(--red)] border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">{err}</div>}

          <button data-testid="register-submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Generating keypair…" : "Create account & mint key"}
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--text-dim)]">
          Already registered? <Link to="/login" className="text-[var(--cyan)] hover:underline">Log in</Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testid, ...rest }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] block mb-2">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-tech"
        {...rest}
      />
    </label>
  );
}
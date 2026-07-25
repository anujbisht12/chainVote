import { useState, useEffect } from "react";

import api, { formatApiError } from "../api";
import { useAuth } from "../auth";
import { Navigate, Link } from "react-router-dom";
import { Plus, Trash2, Lock, Unlock } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const [elections, setElections] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", candidates: [{ name: "", party: "", manifesto: "" }] });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => api.get("/elections").then((r) => setElections(r.data));
  useEffect(() => { refresh(); }, []);

  if (user === null) return null;
  if (user?.role !== "admin") return <Navigate to="/" replace/>;

  const addCandidate = () => setForm({ ...form, candidates: [...form.candidates, { name: "", party: "", manifesto: "" }] });
  const removeCandidate = (i) => setForm({ ...form, candidates: form.candidates.filter((_, idx) => idx !== i) });
  const updateCandidate = (i, field, val) => {
    const arr = [...form.candidates];
    arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, candidates: arr });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!form.title.trim()) return setErr("Title is required");
    const filled = form.candidates.filter((c) => c.name.trim());
    if (filled.length < 2) return setErr("Add at least 2 candidates");
    setBusy(true);
    try {
      const { data } = await api.post("/elections", { title: form.title, description: form.description, candidates: filled });
      setMsg(`Election created · block ${data.block_hash.slice(0, 12)}…`);
      setForm({ title: "", description: "", candidates: [{ name: "", party: "", manifesto: "" }] });
      refresh();
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail, "Failed to create election"));
    } finally {
      setBusy(false);
    }
  };

  const close = async (id) => {
    if (!window.confirm("Close this election? This is irreversible.")) return;
    try {
      await api.post(`/elections/${id}/close`);
      refresh();
    } catch (e) {
      alert(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-12 gap-10" data-testid="admin-page">
      <div className="md:col-span-7">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">/admin/console</div>
        <h1 className="text-5xl text-white tracking-tighter mb-2">Election Commission</h1>
        <p className="text-[var(--text-dim)] mb-10">Create and manage elections. Every action is recorded on-chain.</p>

        <form onSubmit={submit} className="card-tech p-8 space-y-4" data-testid="admin-election-form">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--cyan)] mb-2">NEW ELECTION</div>
          <input data-testid="admin-title" className="input-tech" placeholder="Election title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/>
          <textarea data-testid="admin-description" className="input-tech h-24 resize-none" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/>

          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] pt-2">Candidates</div>
          {form.candidates.map((c, i) => (
            <div key={i} className="grid md:grid-cols-12 gap-2 border border-[var(--border)] p-3">
              <input data-testid={`candidate-name-${i}`} className="input-tech md:col-span-4" placeholder="Name" value={c.name} onChange={(e) => updateCandidate(i, "name", e.target.value)}/>
              <input data-testid={`candidate-party-${i}`} className="input-tech md:col-span-3" placeholder="Party" value={c.party} onChange={(e) => updateCandidate(i, "party", e.target.value)}/>
              <input className="input-tech md:col-span-4" placeholder="Manifesto (optional)" value={c.manifesto} onChange={(e) => updateCandidate(i, "manifesto", e.target.value)}/>
              <button type="button" onClick={() => removeCandidate(i)} className="btn-ghost md:col-span-1 flex items-center justify-center" disabled={form.candidates.length <= 1}>
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
          <button type="button" data-testid="add-candidate-btn" onClick={addCandidate} className="btn-ghost inline-flex items-center gap-2"><Plus size={14}/> Add candidate</button>

          {err && <div data-testid="admin-error" className="text-sm text-[var(--red)] border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">{err}</div>}
          {msg && <div data-testid="admin-success" className="text-sm text-[var(--cyan)] border border-[var(--cyan)]/30 bg-[var(--cyan)]/10 px-3 py-2 font-mono">{msg}</div>}

          <button data-testid="admin-create-election" disabled={busy} className="btn-primary w-full">
            {busy ? "Mining election block…" : "Create election"}
          </button>
        </form>
      </div>

      <aside className="md:col-span-5">
        <div className="card-tech p-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-4">All elections</div>
          {elections.length === 0 ? (
            <div className="text-[var(--text-dim)] text-sm">No elections yet.</div>
          ) : (
            <ul className="space-y-3">
              {elections.map((e) => (
                <li key={e.id} className="border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link to={`/elections/${e.id}`} className="text-white hover:text-[var(--cyan)]">{e.title}</Link>
                    <span className={`tag ${e.status === "open" ? "tag-open" : "tag-closed"}`}>{e.status}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mb-3">{e.candidates.length} candidates · created {new Date(e.created_at).toLocaleDateString()}</div>
                  {e.status === "open" ? (
                    <button data-testid={`close-election-${e.id}`} onClick={() => close(e.id)} className="btn-ghost inline-flex items-center gap-2 text-xs"><Lock size={12}/> Close voting</button>
                  ) : (
                    <span className="tag tag-closed inline-flex items-center gap-1"><Unlock size={10}/> Ended {e.closed_at && new Date(e.closed_at).toLocaleDateString()}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
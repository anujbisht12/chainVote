import { useState, useEffect } from "react";

import api from "../api";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Vote, ArrowRight } from "lucide-react";

export default function Elections() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/elections").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="elections-page">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">/elections</div>
          <h1 className="text-5xl text-white tracking-tighter">Active elections</h1>
        </div>
        {user?.role === "admin" && (
          <Link to="/admin" className="btn-ghost">Create new</Link>
        )}
      </div>

      {loading ? (
        <div className="text-[var(--text-dim)] font-mono">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card-tech p-12 text-center">
          <Vote size={32} className="mx-auto text-[var(--text-dim)] mb-4"/>
          <div className="text-white text-lg mb-2">No elections yet</div>
          <div className="text-sm text-[var(--text-dim)]">The Election Commission hasn't opened any ballot boxes.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {items.map((e) => (
            <Link
              key={e.id}
              to={`/elections/${e.id}`}
              data-testid={`election-card-${e.id}`}
              className="card-tech hover p-8 block transition-transform"
            >
              <div className="flex items-start justify-between mb-4">
                <span className={`tag ${e.status === "open" ? "tag-open" : "tag-closed"}`}>{e.status}</span>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="text-2xl text-white tracking-tight mb-2">{e.title}</h3>
              <p className="text-sm text-[var(--text-dim)] mb-6 line-clamp-2">{e.description || "—"}</p>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-widest">{e.candidates.length} candidates</span>
                <ArrowRight size={16} className="text-[var(--cyan)]"/>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
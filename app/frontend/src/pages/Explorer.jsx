import { useState, useEffect } from "react";

import api from "../api";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Boxes, Search, ShieldCheck } from "lucide-react";

export default function Explorer() {
  const [blocks, setBlocks] = useState([]);
  const [verify, setVerify] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [q, setQ] = useState("");
  const [params] = useSearchParams();

  const refresh = () => {
    api.get("/chain?limit=500").then((r) => {
      setBlocks(r.data.slice().reverse());
      const hash = params.get("hash");
      if (hash) setExpanded(hash);
    });
  };

  useEffect(refresh, []);

  const runVerify = async () => {
    setVerify({ loading: true });
    const { data } = await api.get("/chain/verify");
    setVerify(data);
  };

  const filtered = blocks.filter((b) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return b.hash.includes(s) || (b.data?.election_id || "").toLowerCase().includes(s) || (b.data?.voter_tag || "").includes(s);
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="explorer-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">/chain/explorer</div>
          <h1 className="text-5xl text-white tracking-tighter flex items-center gap-3">
            Ledger explorer <Boxes className="text-[var(--cyan)]" size={38}/>
          </h1>
          <p className="text-[var(--text-dim)] mt-2">Every block, publicly readable. Anyone can verify the chain in one click.</p>
        </div>
        <button data-testid="verify-chain-btn" onClick={runVerify} className="btn-primary inline-flex items-center gap-2">
          <ShieldCheck size={14}/> Verify chain integrity
        </button>
      </div>

      {verify && (
        <div
          data-testid="verify-result"
          className={`card-tech p-6 mb-8 flex items-start gap-4 ${verify.loading ? "" : verify.valid ? "border-[var(--cyan)]/40" : "border-[var(--red)]/40"}`}
        >
          {verify.loading ? (
            <div className="text-[var(--text-dim)] font-mono">VERIFYING [||||||||||    ]</div>
          ) : verify.valid ? (
            <>
              <CheckCircle2 size={24} className="text-[var(--cyan)] shrink-0"/>
              <div>
                <div className="text-white text-lg">Chain is valid ✓</div>
                <div className="mono-hash mt-1">{verify.length} blocks · head {verify.head} · pow-{verify.difficulty}</div>
              </div>
            </>
          ) : (
            <>
              <XCircle size={24} className="text-[var(--red)] shrink-0"/>
              <div>
                <div className="text-white text-lg">Chain integrity broken</div>
                <div className="mono-hash mt-1">at block #{verify.broken_at} · reason: {verify.reason}</div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card-tech p-4 mb-6 flex items-center gap-3">
        <Search size={16} className="text-[var(--text-dim)]"/>
        <input
          data-testid="explorer-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by block hash, election id, voter tag…"
          className="bg-transparent outline-none flex-1 font-mono text-sm text-white"
        />
      </div>

      <div className="card-tech overflow-x-auto">
        <table className="tech-table" data-testid="explorer-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Block hash</th>
              <th>Prev hash</th>
              <th>Nonce</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <>
                <tr key={b.hash} className="cursor-pointer" onClick={() => setExpanded(expanded === b.hash ? null : b.hash)} data-testid={`block-row-${b.index}`}>
                  <td className="font-mono">#{b.index}</td>
                  <td>
                    <span className={`tag ${b.data?.type === "genesis" ? "tag-pending" : b.data?.type === "vote" ? "tag-open" : "tag-closed"}`}>
                      {b.data?.type || "block"}
                    </span>
                  </td>
                  <td className="mono-hash">{b.hash.slice(0, 20)}…{b.hash.slice(-8)}</td>
                  <td className="mono-hash">{b.prev_hash.slice(0, 16)}…</td>
                  <td className="font-mono text-white">{b.nonce}</td>
                  <td className="font-mono text-xs text-[var(--text-dim)]">{new Date(b.timestamp).toLocaleString()}</td>
                </tr>
                {expanded === b.hash && (
                  <tr key={b.hash + "-x"} className="bg-black/40">
                    <td colSpan={6} className="p-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-2">Full block hash</div>
                          <div className="mono-hash text-white text-sm mb-4 break-all">{b.hash}</div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-2">Previous</div>
                          <div className="mono-hash text-sm mb-4 break-all">{b.prev_hash}</div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-2">Timestamp</div>
                          <div className="font-mono text-sm text-white">{new Date(b.timestamp).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-2">Payload</div>
                          <pre className="bg-black/60 border border-[var(--border)] p-3 text-xs text-[var(--cyan)] overflow-auto">{JSON.stringify(b.data, null, 2)}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-[var(--text-dim)]">No blocks match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
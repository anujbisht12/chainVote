import { useState, useEffect } from "react";

import api from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#00F0FF", "#0055FF", "#FFCC00", "#FF3366", "#A78BFA", "#34D399"];

export default function Results({ electionId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/elections/${electionId}/results`).then((r) => setData(r.data));
  }, [electionId]);

  if (!data) return <div className="max-w-7xl mx-auto px-6 py-16 text-[var(--text-dim)]">Loading results…</div>;

  const winner = [...data.tally].sort((a, b) => b.votes - a.votes)[0];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16" data-testid="results-page">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">FINAL TALLY · {data.status}</div>
      <h1 className="text-5xl text-white tracking-tighter mb-2">{data.election.title}</h1>
      <p className="text-[var(--text-dim)] mb-10">Total ballots on-chain: <span data-testid="results-total" className="text-white font-mono">{data.total_votes}</span></p>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="card-tech p-6 md:col-span-2 h-96">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-4">Vote distribution</div>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={data.tally}>
              <XAxis dataKey="name" stroke="#71717A" tick={{ fill: "#A1A1AA", fontFamily: "JetBrains Mono", fontSize: 11 }}/>
              <YAxis stroke="#71717A" tick={{ fill: "#A1A1AA", fontFamily: "JetBrains Mono", fontSize: 11 }} allowDecimals={false}/>
              <Tooltip contentStyle={{ background: "#0d0d0f", border: "1px solid #27272a", borderRadius: 0 }} labelStyle={{ color: "#fff" }}/>
              <Bar dataKey="votes" radius={[0, 0, 0, 0]}>
                {data.tally.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card-tech p-8">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">Leader</div>
          <div className="text-4xl text-white tracking-tight mb-2" data-testid="results-winner-name">{winner?.name || "—"}</div>
          <div className="text-sm text-[var(--text-dim)] font-mono uppercase mb-6">{winner?.party || ""}</div>
          <div className="text-[var(--cyan)] text-6xl font-mono" data-testid="results-winner-votes">{winner?.votes ?? 0}</div>
          <div className="text-xs text-[var(--text-dim)] font-mono uppercase tracking-widest">votes</div>
        </div>
      </div>

      <div className="card-tech overflow-hidden">
        <table className="tech-table">
          <thead>
            <tr><th>#</th><th>Candidate</th><th>Party</th><th className="text-right">Votes</th><th className="text-right">Share</th></tr>
          </thead>
          <tbody>
            {[...data.tally].sort((a, b) => b.votes - a.votes).map((c, i) => {
              const pct = data.total_votes > 0 ? ((c.votes / data.total_votes) * 100).toFixed(1) : "0.0";
              return (
                <tr key={c.candidate_id}>
                  <td className="font-mono text-[var(--text-dim)]">{String(i + 1).padStart(2, "0")}</td>
                  <td className="text-white">{c.name}</td>
                  <td className="text-[var(--text-dim)]">{c.party || "—"}</td>
                  <td className="text-right font-mono text-white">{c.votes}</td>
                  <td className="text-right font-mono text-[var(--cyan)]">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
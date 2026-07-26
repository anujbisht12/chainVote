import { useState, useEffect } from "react";

import { useAuth } from "../auth";
import api from "../api";
import { Link } from "react-router-dom";
import { KeyRound, Vote, Shield } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState([]);
  const [myVotes, setMyVotes] = useState([]);

  useEffect(() => {
    api.get("/elections").then((r) => setElections(r.data));
    api.get("/my-votes").then((r) => setMyVotes(r.data)).catch(() => {});
  }, []);

  const votedIds = new Set(myVotes.map((v) => v.election_id));

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="dashboard-page">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">/voter/dashboard</div>
      <h1 className="text-5xl text-white tracking-tighter mb-2">Hello, {user?.name}</h1>
      <p className="text-[var(--text-dim)] mb-10 font-mono text-xs uppercase tracking-widest">
        Voter tag &middot; <span className="text-[var(--cyan)]" data-testid="dashboard-voter-tag">{user?.voter_tag}</span>
      </p>

      <div className="grid md:grid-cols-12 gap-6">
        <StatCard icon={<Vote size={18}/>} label="Elections available" value={elections.length}/>
        <StatCard icon={<KeyRound size={18}/>} label="Ballots you've cast" value={myVotes.length}/>
        <StatCard icon={<Shield size={18}/>} label="Account type" value={user?.role?.toUpperCase()}/>

        <div className="md:col-span-8 card-tech p-8">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-4">Open ballots</div>
          {elections.filter((e) => e.status === "open").length === 0 ? (
            <div className="text-[var(--text-dim)]">No open elections right now.</div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {elections.filter((e) => e.status === "open").map((e) => (
                <li key={e.id} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-white text-lg">{e.title}</div>
                    <div className="text-xs text-[var(--text-dim)] font-mono uppercase tracking-widest">{e.candidates.length} candidates</div>
                  </div>
                  {votedIds.has(e.id) ? (
                    <span className="tag tag-pending">voted</span>
                  ) : (
                    <Link to={`/elections/${e.id}`} className="btn-primary">Cast vote</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-4 card-tech p-8">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-4">Your receipts</div>
          {myVotes.length === 0 ? (
            <div className="text-[var(--text-dim)] text-sm">Cast your first ballot to see your on-chain receipts here.</div>
          ) : (
            <ul className="space-y-4">
              {myVotes.map((v) => (
                <li key={v.id} className="pb-4 border-b border-[var(--border)] last:border-b-0 last:pb-0">
                  <div className="text-white text-sm mb-1">Election <span className="font-mono text-[var(--text-dim)]">{v.election_id.slice(0, 8)}</span></div>
                  <Link to={`/explorer?hash=${v.block_hash}`} className="mono-hash text-[var(--cyan)] hover:underline block break-all">
                    {v.block_hash}
                  </Link>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mt-1">Block #{v.block_index}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="md:col-span-4 card-tech p-6 flex items-center gap-5">
      <div className="w-12 h-12 border border-[var(--border-strong)] flex items-center justify-center text-[var(--cyan)]">{icon}</div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">{label}</div>
        <div className="text-3xl text-white font-mono">{value}</div>
      </div>
    </div>
  );
}
import { Link } from "react-router-dom";

import { ArrowRight, ShieldCheck, Boxes, KeyRound, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api";

export default function Landing() {
  const [stats, setStats] = useState({ voters: 0, elections: 0, blocks: 0, votes: 0, difficulty: 3 });

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page" className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-12 gap-8 relative">
          <div className="md:col-span-8">
            <div className="tag tag-open mb-6"><span className="w-1.5 h-1.5 bg-[var(--cyan)] inline-block"></span>LIVE · MAINNET-ALPHA</div>
            <h1 className="text-5xl md:text-7xl text-white leading-[0.95] tracking-tighter" data-testid="hero-title">
              A ballot that can't<br/>
              be lost, changed,<br/>
              or silenced.<span className="text-[var(--cyan)] blink">_</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[var(--text-dim)] text-lg leading-relaxed">
              ChainVote is an end-to-end verifiable voting portal. Every ballot is cryptographically signed
              with RSA-2048, sealed into a SHA-256 proof-of-work chain, and permanently visible in the
              public explorer — while your identity stays anonymous.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link data-testid="cta-register" to="/register" className="btn-primary inline-flex items-center gap-2">
                Get your voter key <ArrowRight size={16}/>
              </Link>
              <Link data-testid="cta-explorer" to="/explorer" className="btn-ghost inline-flex items-center gap-2">
                Open blockchain explorer
              </Link>
            </div>
          </div>
          <div className="md:col-span-4">
            <div className="card-tech p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-4">Network Status</div>
              <StatRow label="Difficulty" value={`0x${"0".repeat(stats.difficulty)}…`}/>
              <StatRow label="Blocks" value={stats.blocks} testid="stat-blocks"/>
              <StatRow label="Voters" value={stats.voters} testid="stat-voters"/>
              <StatRow label="Elections" value={stats.elections} testid="stat-elections"/>
              <StatRow label="Ballots cast" value={stats.votes} testid="stat-votes"/>
              <div className="marquee-line my-4"/>
              <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest">
                Consensus: SHA-256 PoW · Sig: RSA-2048/PSS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid md:grid-cols-3 gap-6">
          <FeatureCard icon={<KeyRound size={20}/>} title="RSA-2048 Voter Keys" desc="On registration you receive a private key — the sole instrument that can sign your ballot. Nobody else, not even us, can vote as you." num="01"/>
          <FeatureCard icon={<Boxes size={20}/>} title="Immutable PoW Ledger" desc="Each ballot becomes a mined block with SHA-256 proof-of-work. Any tampering breaks the chain and is detected instantly." num="02"/>
          <FeatureCard icon={<Fingerprint size={20}/>} title="Anonymous by Design" desc="Voter identity is replaced with a salted voter-tag hash on-chain. Prove your vote counts without revealing who you are." num="03"/>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl text-white tracking-tighter">
              Every ballot,<br/>publicly auditable<span className="text-[var(--cyan)]">.</span>
            </h2>
            <p className="mt-4 text-[var(--text-dim)] max-w-lg">
              Read the entire history of votes — hash, previous hash, nonce, and voter-tag — right in your browser. Verify the chain yourself in one click.
            </p>
          </div>
          <div className="card-tech p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">GENESIS BLOCK</div>
              <ShieldCheck size={14} className="text-[var(--cyan)]"/>
            </div>
            <div className="mono-hash text-white text-sm leading-loose">
              0x0000c746cb74c86…4a2f5e91b7c<br/>
              <span className="text-[var(--text-dim)]">prev</span> 0x0000000000000000000<br/>
              <span className="text-[var(--text-dim)]">data</span> "ChainVote Genesis Block"
            </div>
            <Link to="/explorer" className="btn-ghost inline-flex items-center gap-2 mt-6">Explore ledger <ArrowRight size={14}/></Link>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between text-xs text-[var(--text-dim)]">
        <span className="font-mono uppercase tracking-widest">© ChainVote · 2026</span>
        <span className="font-mono">SHA-256 · RSA-PSS · PoW-{stats.difficulty}</span>
      </footer>
    </div>
  );
}

function StatRow({ label, value, testid }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-[var(--border)] last:border-b-0">
      <span className="text-xs text-[var(--text-dim)] font-mono uppercase tracking-widest">{label}</span>
      <span data-testid={testid} className="text-white font-mono">{value}</span>
    </div>
  );
}

function FeatureCard({ icon, title, desc, num }) {
  return (
    <div className="card-tech p-8 relative">
      <div className="absolute top-4 right-4 text-[10px] font-mono text-[var(--text-dim)]">{num}</div>
      <div className="w-10 h-10 border border-[var(--border-strong)] flex items-center justify-center mb-6 text-[var(--cyan)]">{icon}</div>
      <h3 className="text-white text-xl tracking-tight mb-3">{title}</h3>
      <p className="text-sm text-[var(--text-dim)] leading-relaxed">{desc}</p>
    </div>
  );
}
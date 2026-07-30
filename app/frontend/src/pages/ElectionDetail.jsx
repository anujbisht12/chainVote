import { useState, useEffect } from "react";

import { useParams, useNavigate, Link } from "react-router-dom";
import api, { formatApiError } from "../api";
import { useAuth } from "../auth";
import { ShieldCheck, KeyRound, Upload, CheckCircle2, Boxes } from "lucide-react";
import Results from "./Results";
import { signMessage, looksLikePrivateKeyPem } from "../lib/voteCrypto";

export default function ElectionDetail() {
  const { electionId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [election, setElection] = useState(null);
  const [selected, setSelected] = useState(null);
  const [privateKey, setPrivateKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [err, setErr] = useState("");
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  useEffect(() => {
    api.get(`/elections/${electionId}`).then((r) => setElection(r.data));
    if (user?.role === "voter") {
      api.get("/my-votes").then((r) => {
        if (r.data.some((v) => v.election_id === electionId)) setAlreadyVoted(true);
      }).catch(() => {});
    }
  }, [electionId, user]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPrivateKey(String(r.result || ""));
    r.readAsText(f);
  };

  const castVote = async () => {
    setErr("");
    if (!selected) return setErr("Choose a candidate first.");
    if (!privateKey.trim()) return setErr("Paste or upload your private key to sign the ballot.");
    if (!looksLikePrivateKeyPem(privateKey)) {
      return setErr("That doesn't look like a valid private key file (.pem). Check you uploaded the right file.");
    }
    setSubmitting(true);
    try {
      // The exact same message format the server verifies against:
      // election_id | candidate_id | voter_tag
      const message = `${electionId}|${selected}|${user.voter_tag}`;

      // Signing happens right here, in the browser. `privateKey` is a
      // local variable that lives only in this component's state — it is
      // never included in the request body below.
      const signature = await signMessage(privateKey, message);

      const { data } = await api.post("/vote", {
        election_id: electionId,
        candidate_id: selected,
        signature,
      });
      setReceipt(data.receipt);

      // Clear the private key from memory as soon as we're done with it.
      setPrivateKey("");
    } catch (e) {
      if (e?.response) {
        setErr(formatApiError(e.response?.data?.detail, "Vote failed"));
      } else {
        setErr("Could not sign this ballot with the provided key. Make sure it's the correct .pem file.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!election) return <div className="max-w-7xl mx-auto px-6 py-16 text-[var(--text-dim)]">Loading election…</div>;

  if (election.status === "closed") return <Results electionId={electionId}/>;

  if (receipt) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16" data-testid="vote-receipt-page">
        <div className="card-tech p-10">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 size={24} className="text-[var(--cyan)]"/>
            <h1 className="text-3xl text-white tracking-tight">Ballot sealed on-chain</h1>
          </div>
          <p className="text-[var(--text-dim)] mb-8">
            Your ballot was signed in your browser with your RSA-2048 private key and mined into block <span className="font-mono text-white">#{receipt.block_index}</span>. Keep this receipt — anyone can verify it in the public explorer without learning your identity.
          </p>
          <ReceiptRow label="BLOCK INDEX" value={`#${receipt.block_index}`}/>
          <ReceiptRow label="BLOCK HASH" value={receipt.block_hash} testid="receipt-block-hash"/>
          <ReceiptRow label="PREV HASH" value={receipt.prev_hash}/>
          <ReceiptRow label="VOTER TAG (anonymous)" value={receipt.voter_tag}/>
          <ReceiptRow label="TIMESTAMP" value={new Date(receipt.timestamp).toLocaleString()}/>
          <div className="flex gap-3 mt-8">
            <Link to={`/explorer?hash=${receipt.block_hash}`} className="btn-primary inline-flex items-center gap-2">
              <Boxes size={14}/> View in explorer
            </Link>
            <button className="btn-ghost" onClick={() => nav("/dashboard")}>Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-12 gap-10" data-testid="election-detail-page">
      <div className="md:col-span-7">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">
          BALLOT · {election.id.slice(0, 8)}
        </div>
        <h1 className="text-4xl md:text-5xl text-white tracking-tighter mb-3">{election.title}</h1>
        <p className="text-[var(--text-dim)] mb-8">{election.description || "Cast your one, verifiable ballot below."}</p>

        <div className="space-y-3">
          {election.candidates.map((c) => (
            <button
              key={c.id}
              data-testid={`candidate-${c.id}`}
              onClick={() => setSelected(c.id)}
              disabled={alreadyVoted}
              className={`w-full text-left p-5 border transition-colors ${selected === c.id ? "border-[var(--cyan)] bg-[var(--cyan)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"} ${alreadyVoted ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-4 h-4 mt-1 border ${selected === c.id ? "bg-[var(--cyan)] border-[var(--cyan)]" : "border-[var(--border-strong)]"}`}/>
                <div className="flex-1">
                  <div className="text-white text-lg">{c.name}</div>
                  {c.party && <div className="text-xs text-[var(--text-dim)] font-mono uppercase tracking-widest mt-1">{c.party}</div>}
                  {c.manifesto && <div className="text-sm text-[var(--text-dim)] mt-2">{c.manifesto}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="md:col-span-5">
        <div className="card-tech p-6 sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-[var(--cyan)]"/>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">SIGN & CAST</div>
          </div>

          {!user ? (
            <div className="text-sm text-[var(--text-dim)]">
              You must <Link to="/login" className="text-[var(--cyan)] hover:underline">log in</Link> to vote.
            </div>
          ) : alreadyVoted ? (
            <div className="text-sm text-[var(--yellow)] border border-[var(--yellow)]/40 bg-[var(--yellow)]/5 p-3" data-testid="already-voted-notice">
              You've already voted in this election. One voter, one ballot.
            </div>
          ) : user.role !== "voter" ? (
            <div className="text-sm text-[var(--text-dim)]">Admin accounts cannot cast ballots.</div>
          ) : (
            <>
              <div className="text-xs text-[var(--text-dim)] mb-3">
                Paste your RSA private key (.pem) or upload the file you saved at registration. It's signed right here in your browser and is never transmitted to our servers.
              </div>
              <textarea
                data-testid="vote-privatekey-input"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;…&#10;-----END PRIVATE KEY-----"
                className="input-tech font-mono text-xs h-36 resize-none"
                autoComplete="off"
                spellCheck={false}
              />
              <label className="btn-ghost inline-flex items-center gap-2 mt-3 cursor-pointer">
                <Upload size={12}/> Upload .pem
                <input data-testid="vote-privatekey-file" type="file" accept=".pem,.txt" onChange={onFile} className="hidden"/>
              </label>

              {err && <div data-testid="vote-error" className="text-sm text-[var(--red)] border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2 mt-4">{err}</div>}

              <button
                data-testid="cast-vote-btn"
                disabled={submitting || !selected}
                className="btn-primary w-full mt-6 inline-flex items-center justify-center gap-2"
                onClick={castVote}
              >
                <KeyRound size={14}/> {submitting ? "Signing in your browser…" : "Sign & Cast Ballot"}
              </button>
              <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest mt-4">
                Signed locally: election_id | candidate_id | voter_tag
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function ReceiptRow({ label, value, testid }) {
  return (
    <div className="py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1">{label}</div>
      <div data-testid={testid} className="mono-hash text-white text-sm">{value}</div>
    </div>
  );
}

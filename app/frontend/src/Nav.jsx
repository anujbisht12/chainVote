import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { ShieldCheck, LogOut, Boxes, Vote, LayoutDashboard, Lock } from "lucide-react";

export default function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-[var(--border)]"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2 group">
          <div className="w-8 h-8 border border-[var(--border-strong)] flex items-center justify-center bg-[var(--surface-2)]">
            <ShieldCheck size={16} className="text-[var(--cyan)]" />
          </div>
          <div className="leading-tight">
            <div className="text-white font-semibold tracking-tight" style={{ fontFamily: "Chivo" }}>
              CHAIN<span className="text-[var(--cyan)]">VOTE</span>
            </div>
            <div className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest">SECURE.LEDGER.v1</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
          <Link data-testid="nav-explorer" to="/explorer" className="px-3 py-2 text-[var(--text-dim)] hover:text-white transition-colors">
            <span className="inline-flex items-center gap-2"><Boxes size={14}/>Explorer</span>
          </Link>
          <Link data-testid="nav-elections" to="/elections" className="px-3 py-2 text-[var(--text-dim)] hover:text-white transition-colors">
            <span className="inline-flex items-center gap-2"><Vote size={14}/>Elections</span>
          </Link>
          {user && (
            <Link data-testid="nav-dashboard" to="/dashboard" className="px-3 py-2 text-[var(--text-dim)] hover:text-white transition-colors">
              <span className="inline-flex items-center gap-2"><LayoutDashboard size={14}/>Dashboard</span>
            </Link>
          )}
          {user?.role === "admin" && (
            <Link data-testid="nav-admin" to="/admin" className="px-3 py-2 text-[var(--text-dim)] hover:text-white transition-colors">
              <span className="inline-flex items-center gap-2"><Lock size={14}/>Admin</span>
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span data-testid="nav-user-name" className="text-sm text-white">{user.name}</span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest">{user.role}</span>
              </div>
              <button data-testid="logout-btn" className="btn-ghost inline-flex items-center gap-2" onClick={() => { logout(); nav("/"); }}>
                <LogOut size={14}/> Logout
              </button>
            </>
          ) : (
            <>
              <Link data-testid="login-link" to="/login" className="btn-ghost">Login</Link>
              <Link data-testid="register-link" to="/register" className="btn-primary">Register to Vote</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
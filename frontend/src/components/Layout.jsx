import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-full flex flex-col bg-amz-bg bg-amz-radial">
      <header className="border-b border-amz-border bg-amz-panel/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amz-accent to-amz-accent2 font-black text-white shadow-glow">
              A
            </span>
            <span className="font-bold tracking-wide text-lg">AMZ</span>
            <span className="text-xs text-gray-500 hidden sm:inline border-l border-amz-border pl-2.5">
              Recon Automation
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user && (
              <span className="text-gray-400 hidden sm:flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {user.email}
              </span>
            )}
            {user && (
              <button
                onClick={() => { logout(); nav("/login"); }}
                className="text-gray-300 hover:text-white hover:border-amz-accent transition-colors border border-amz-border rounded-md px-3 py-1.5"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-amz-border text-xs text-gray-600 py-5 px-6 text-center">
        For use only on targets you are authorized to test (owned assets or in-scope bug bounty programs).
      </footer>
    </div>
  );
}
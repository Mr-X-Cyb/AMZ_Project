import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      nav("/");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-amz-bg bg-amz-radial">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amz-accent to-amz-accent2 font-black text-white text-xl shadow-glow">
            A
          </span>
          <div>
            <div className="font-black text-2xl tracking-wide leading-none">AMZ</div>
            <div className="text-xs text-gray-500 mt-1">Bug Bounty Recon Automation</div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-amz-panel border border-amz-border rounded-2xl p-7 space-y-5 shadow-xl shadow-black/30">
          <div>
            <h1 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
            <p className="text-xs text-gray-500 mt-1">
              {mode === "login" ? "Welcome back — enter your details." : "Start automating your recon."}
            </p>
          </div>

          {err && (
            <div className="bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg px-3 py-2.5">
              {err}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-amz-bg border border-amz-border rounded-lg px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-amz-accent focus:ring-1 focus:ring-amz-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-amz-bg border border-amz-border rounded-lg px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-amz-accent focus:ring-1 focus:ring-amz-accent transition-colors"
            />
          </div>
          <button
            disabled={busy}
            className="w-full bg-gradient-to-r from-amz-accent to-indigo-500 hover:brightness-110 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-all shadow-glow"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
            className="w-full text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </form>
        <p className="text-xs text-gray-600 text-center mt-6">
          For use only on targets you are authorized to test.
        </p>
      </div>
    </div>
  );
}
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amz-accent to-amz-accent2 font-black text-white text-xl">
            A
          </span>
          <div>
            <div className="font-black text-2xl tracking-wide">AMZ</div>
            <div className="text-xs text-gray-500">Bug Bounty Recon Automation</div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-amz-panel border border-amz-border rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
          {err && <div className="bg-red-950 border border-red-800 text-red-200 text-sm rounded-md px-3 py-2">{err}</div>}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-amz-bg border border-amz-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amz-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-amz-bg border border-amz-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amz-accent"
            />
          </div>
          <button
            disabled={busy}
            className="w-full bg-amz-accent hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-md py-2 text-sm"
          >
            {busy ? "..." : mode === "login" ? "Sign in" : "Register"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
            className="w-full text-xs text-gray-400 hover:text-gray-200"
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

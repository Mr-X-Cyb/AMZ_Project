import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { StatusBadge } from "../components/Badge.jsx";

export default function Dashboard() {
  const [scans, setScans] = useState([]);
  const [target, setTarget] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(null);

  const load = async () => {
    try {
      setScans(await api.listScans());
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    load();
    api.config().then((c) => setAiEnabled(c.ai_enabled)).catch(() => {});
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!authorized) {
      setErr("You must confirm authorization before scanning.");
      return;
    }
    setBusy(true);
    try {
      await api.createScan(target, authorized);
      setTarget("");
      setAuthorized(false);
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this scan and its results?")) return;
    await api.deleteScan(id);
    await load();
  };

  const completed = scans.filter((s) => s.status === "completed").length;
  const running = scans.filter((s) => s.status === "running" || s.status === "pending").length;

  return (
    <div className="space-y-8">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total scans", value: scans.length },
          { label: "Completed", value: completed },
          { label: "In progress", value: running },
        ].map((s) => (
          <div key={s.label} className="bg-amz-panel border border-amz-border rounded-xl px-5 py-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New scan form */}
      <section className="bg-amz-panel border border-amz-border rounded-2xl p-6 shadow-xl shadow-black/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">New recon scan</h1>
            <p className="text-sm text-gray-400 mt-1">
              Passive enumeration only (CT logs, DNS, HTTP GET/HEAD). No brute force, no exploitation.
            </p>
          </div>
          {aiEnabled === false && (
            <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800 rounded-full px-3 py-1 whitespace-nowrap">
              Heuristic scoring
            </span>
          )}
          {aiEnabled === true && (
            <span className="text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800 rounded-full px-3 py-1 whitespace-nowrap">
              AI ranking active
            </span>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="example.com"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              className="flex-1 bg-amz-bg border border-amz-border rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-amz-accent focus:ring-1 focus:ring-amz-accent transition-colors"
            />
            <button
              disabled={busy || !authorized}
              className="bg-gradient-to-r from-amz-accent to-indigo-500 hover:brightness-110 disabled:opacity-40 disabled:grayscale text-white font-medium rounded-lg px-6 py-2.5 text-sm whitespace-nowrap transition-all shadow-glow"
            >
              {busy ? "Starting…" : "Start scan"}
            </button>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amz-accent rounded"
            />
            <span>
              I confirm I am <b className="text-white">authorized</b> to test this target (I own it or it is
              in-scope for a bug bounty program). This confirmation is timestamped and logged.
            </span>
          </label>

          {err && (
            <div className="bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg px-3 py-2.5">
              {err}
            </div>
          )}
        </form>
      </section>

      {/* Scans table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Scans</h2>
        <div className="bg-amz-panel border border-amz-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-sm">
            <thead className="bg-amz-panel2 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium">Target</th>
                <th className="text-left px-5 py-3.5 font-medium">Status</th>
                <th className="text-left px-5 py-3.5 font-medium">AI</th>
                <th className="text-left px-5 py-3.5 font-medium">Created</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="text-gray-600 text-sm">No scans yet</div>
                    <div className="text-gray-700 text-xs mt-1">Start your first recon scan above.</div>
                  </td>
                </tr>
              )}
              {scans.map((s) => (
                <tr key={s.id} className="border-t border-amz-border hover:bg-amz-panel2/60 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link to={`/scans/${s.id}`} className="text-amz-accent2 hover:underline font-medium">
                      {s.target_domain}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{s.ai_provider || "—"}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => remove(s.id)}
                      className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
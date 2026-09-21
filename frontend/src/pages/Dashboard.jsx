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
    // Poll so running scans update live without a refresh.
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

  return (
    <div className="space-y-8">
      <section className="bg-amz-panel border border-amz-border rounded-xl p-6">
        <h1 className="text-xl font-semibold mb-1">New recon scan</h1>
        <p className="text-sm text-gray-400 mb-4">
          Passive enumeration only (CT logs, DNS, HTTP GET/HEAD). No brute force, no exploitation.
          {aiEnabled === false && (
            <span className="block mt-1 text-amber-400">
              AI ranking key not set — results use the built-in heuristic scorer.
            </span>
          )}
          {aiEnabled === true && (
            <span className="block mt-1 text-emerald-400">AI ranking active (Anthropic).</span>
          )}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="example.com"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              className="flex-1 bg-amz-bg border border-amz-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amz-accent"
            />
            <button
              disabled={busy || !authorized}
              className="bg-amz-accent hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-md px-6 py-2 text-sm whitespace-nowrap"
            >
              {busy ? "Starting..." : "Start scan"}
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="mt-0.5 accent-amz-accent"
            />
            <span>
              I confirm I am <b>authorized</b> to test this target (I own it or it is in-scope for a
              bug bounty program). This confirmation is timestamped and logged.
            </span>
          </label>

          {err && <div className="text-sm text-red-400">{err}</div>}
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Scans</h2>
        <div className="bg-amz-panel border border-amz-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amz-bg/50 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Target</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">AI</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No scans yet.</td></tr>
              )}
              {scans.map((s) => (
                <tr key={s.id} className="border-t border-amz-border hover:bg-amz-bg/40">
                  <td className="px-4 py-3">
                    <Link to={`/scans/${s.id}`} className="text-amz-accent2 hover:underline font-medium">
                      {s.target_domain}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{s.ai_provider || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(s.id)} className="text-gray-500 hover:text-red-400 text-xs">
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

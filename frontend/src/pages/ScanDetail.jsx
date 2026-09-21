import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, downloadExport } from "../api";
import { StatusBadge, ScoreBadge } from "../components/Badge.jsx";

export default function ScanDetail() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);

  const load = async () => {
    try {
      setScan(await api.getScan(id));
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => {
      setScan((prev) => {
        if (prev && (prev.status === "completed" || prev.status === "failed")) return prev;
        load();
        return prev;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  if (err) return <div className="text-red-400">{err}</div>;
  if (!scan) return <div className="text-gray-500">Loading…</div>;

  const rerun = async () => {
    const s = await api.rerunScan(scan.id);
    window.location.href = `/scans/${s.id}`;
  };

  const hosts = scan.hosts || [];
  const live = hosts.filter((h) => h.is_live);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">← All scans</Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {scan.target_domain} <StatusBadge status={scan.status} />
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {hosts.length} hosts · {live.length} live · AI: {scan.ai_provider || "—"} ·
            authorized {scan.authorized_at ? new Date(scan.authorized_at).toLocaleString() : "n/a"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={rerun} className="border border-amz-border rounded-md px-3 py-1.5 text-sm hover:bg-amz-panel">
            Re-run
          </button>
          <button
            onClick={() => downloadExport(scan.id, "csv", `amz_scan_${scan.id}.csv`)}
            className="border border-amz-border rounded-md px-3 py-1.5 text-sm hover:bg-amz-panel"
          >
            CSV
          </button>
          <button
            onClick={() => downloadExport(scan.id, "pdf", `amz_scan_${scan.id}.pdf`)}
            className="border border-amz-border rounded-md px-3 py-1.5 text-sm hover:bg-amz-panel"
          >
            PDF
          </button>
        </div>
      </div>

      {scan.error && (
        <div className="bg-red-950 border border-red-800 text-red-200 text-sm rounded-md px-4 py-3">
          {scan.error}
        </div>
      )}

      {scan.ai_summary && (
        <div className="bg-amz-panel border border-amz-border rounded-xl p-4">
          <div className="text-xs uppercase text-gray-500 mb-1">AI summary</div>
          <p className="text-sm text-gray-200">{scan.ai_summary}</p>
        </div>
      )}

      {scan.status === "running" && (
        <div className="text-sm text-blue-300 animate-pulse">Scan in progress… results stream in as they finish.</div>
      )}

      <div className="bg-amz-panel border border-amz-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-amz-bg/50 text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Subdomain</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Tech</th>
              <th className="text-left px-4 py-3">Exposed paths</th>
              <th className="text-left px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {hosts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No results yet.</td></tr>
            )}
            {hosts.map((h) => (
              <>
                <tr
                  key={h.id}
                  onClick={() => setOpen(open === h.id ? null : h.id)}
                  className="border-t border-amz-border hover:bg-amz-bg/40 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">
                    {h.is_live && h.scheme ? (
                      <a
                        href={`${h.scheme}://${h.subdomain}`} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-amz-accent2 hover:underline"
                      >
                        {h.subdomain}
                      </a>
                    ) : (
                      <span className="text-gray-400">{h.subdomain}</span>
                    )}
                    {h.title && <div className="text-xs text-gray-500 truncate max-w-xs">{h.title}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {h.is_live ? (
                      <span className="text-emerald-300">{h.status_code}</span>
                    ) : (
                      <span className="text-gray-600">down</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(h.tech || []).map((t) => (
                        <span key={t} className="bg-amz-bg border border-amz-border rounded px-1.5 py-0.5 text-xs text-gray-300">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(h.exposed_paths || []).length === 0 ? (
                      <span className="text-gray-600 text-xs">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(h.exposed_paths || []).map((p) => (
                          <span key={p.path} className="bg-amber-950 border border-amber-800 text-amber-200 rounded px-1.5 py-0.5 text-xs">
                            {p.label} ({p.status})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><ScoreBadge score={h.ai_score} /></td>
                </tr>
                {open === h.id && (
                  <tr className="bg-amz-bg/60">
                    <td colSpan={5} className="px-4 py-3 text-xs text-gray-300 space-y-2">
                      {h.ai_reason && <div><b className="text-gray-400">Why interesting:</b> {h.ai_reason}</div>}
                      <div>
                        <b className="text-gray-400">Response headers:</b>
                        <pre className="mt-1 bg-black/40 rounded p-2 overflow-x-auto">
{JSON.stringify(h.headers || {}, null, 2)}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

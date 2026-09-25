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

  if (err)
    return (
      <div className="bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg px-4 py-3">
        {err}
      </div>
    );
  if (!scan)
    return <div className="text-gray-500 text-sm animate-pulse">Loading…</div>;

  const rerun = async () => {
    const s = await api.rerunScan(scan.id);
    window.location.href = "/scans/" + s.id;
  };

  const hosts = scan.hosts || [];
  const live = hosts.filter(function (h) { return h.is_live; });

  function buildUrl(h) {
    return h.scheme + String.fromCharCode(58, 47, 47) + h.subdomain;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2">
            ← All scans
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {scan.target_domain} <StatusBadge status={scan.status} />
          </h1>
          <p className="text-xs text-gray-500 mt-1.5">
            {hosts.length} hosts · {live.length} live · AI: {scan.ai_provider || "—"} · authorized{" "}
            {scan.authorized_at ? new Date(scan.authorized_at).toLocaleString() : "n/a"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={rerun}
            className="border border-amz-border rounded-lg px-3.5 py-2 text-sm hover:bg-amz-panel2 transition-colors"
          >
            Re-run
          </button>
          <button
            onClick={() => downloadExport(scan.id, "csv", "amz_scan_" + scan.id + ".csv")}
            className="border border-amz-border rounded-lg px-3.5 py-2 text-sm hover:bg-amz-panel2 transition-colors"
          >
            CSV
          </button>
          <button
            onClick={() => downloadExport(scan.id, "pdf", "amz_scan_" + scan.id + ".pdf")}
            className="border border-amz-border rounded-lg px-3.5 py-2 text-sm hover:bg-amz-panel2 transition-colors"
          >
            PDF
          </button>
        </div>
      </div>

      {scan.error && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg px-4 py-3">
          {scan.error}
        </div>
      )}

      {scan.ai_summary && (
        <div className="bg-gradient-to-br from-amz-panel to-amz-panel2 border border-amz-border rounded-2xl p-5">
          <div className="text-xs uppercase text-amz-accent2 font-medium tracking-wide mb-1.5">AI summary</div>
          <p className="text-sm text-gray-200 leading-relaxed">{scan.ai_summary}</p>
        </div>
      )}

      {scan.status === "running" && (
        <div className="flex items-center gap-2 text-sm text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Scan in progress… results stream in as they finish.
        </div>
      )}

      <div className="bg-amz-panel border border-amz-border rounded-2xl overflow-x-auto shadow-xl shadow-black/20">
        <table className="w-full text-sm">
          <thead className="bg-amz-panel2 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3.5 font-medium">Subdomain</th>
              <th className="text-left px-5 py-3.5 font-medium">Status</th>
              <th className="text-left px-5 py-3.5 font-medium">Tech</th>
              <th className="text-left px-5 py-3.5 font-medium">Exposed paths</th>
              <th className="text-left px-5 py-3.5 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {hosts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center text-gray-600 text-sm">
                  No results yet.
                </td>
              </tr>
            )}
            {hosts.map(function (h) {
              return (
                <>
                  <tr
                    key={h.id}
                    onClick={() => setOpen(open === h.id ? null : h.id)}
                    className="border-t border-amz-border hover:bg-amz-panel2/60 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      {h.is_live && h.scheme ? (
                         <a 
                          href={buildUrl(h)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-amz-accent2 hover:underline"
                        >
                          {h.subdomain}
                        </a>
                      ) : (
                        <span className="text-gray-500">{h.subdomain}</span>
                      )}
                      {h.title && (
                        <div className="text-xs text-gray-600 truncate max-w-xs mt-0.5">{h.title}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {h.is_live ? (
                        <span className="text-emerald-400 font-medium">{h.status_code}</span>
                      ) : (
                        <span className="text-gray-700">down</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(h.tech || []).map((t) => (
                          <span
                            key={t}
                            className="bg-amz-bg border border-amz-border rounded px-1.5 py-0.5 text-xs text-gray-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {(h.exposed_paths || []).length === 0 ? (
                        <span className="text-gray-700 text-xs">none</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(h.exposed_paths || []).map((p) => (
                            <span
                              key={p.path}
                              className="bg-amber-950/60 border border-amber-800/60 text-amber-300 rounded px-1.5 py-0.5 text-xs"
                            >
                              {p.label} ({p.status})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><ScoreBadge score={h.ai_score} /></td>
                  </tr>
                  {open === h.id && (
                    <tr className="bg-black/30">
                      <td colSpan={5} className="px-5 py-4 text-xs text-gray-300 space-y-2.5">
                        {h.ai_reason && (
                          <div>
                            <b className="text-gray-500">Why interesting:</b> {h.ai_reason}
                          </div>
                        )}
                        <div>
                          <b className="text-gray-500">Response headers:</b>
                          <pre className="mt-1.5 bg-black/40 border border-amz-border rounded-lg p-3 overflow-x-auto">
                            {JSON.stringify(h.headers || {}, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
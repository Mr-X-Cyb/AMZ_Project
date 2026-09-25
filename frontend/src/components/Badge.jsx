export function StatusBadge({ status }) {
  const map = {
    pending: { cls: "bg-gray-800 text-gray-300 border-gray-700", dot: "bg-gray-400" },
    running: { cls: "bg-blue-950 text-blue-300 border-blue-800", dot: "bg-blue-400 animate-pulse" },
    completed: { cls: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400" },
    failed: { cls: "bg-red-950 text-red-300 border-red-800", dot: "bg-red-400" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

export function ScoreBadge({ score }) {
  if (score === null || score === undefined)
    return <span className="text-gray-700 text-xs">—</span>;
  let cls = "bg-gray-800 text-gray-300 border-gray-700";
  if (score >= 60) cls = "bg-red-950 text-red-300 border-red-800";
  else if (score >= 30) cls = "bg-amber-950 text-amber-300 border-amber-800";
  else if (score > 0) cls = "bg-emerald-950 text-emerald-300 border-emerald-800";
  return (
    <span className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-1 rounded-md text-xs font-bold border ${cls}`}>
      {Math.round(score)}
    </span>
  );
}
export function StatusBadge({ status }) {
  const map = {
    pending: "bg-gray-700 text-gray-200",
    running: "bg-blue-900 text-blue-200 animate-pulse",
    completed: "bg-emerald-900 text-emerald-200",
    failed: "bg-red-900 text-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-gray-700"}`}>
      {status}
    </span>
  );
}

export function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-gray-600">—</span>;
  let cls = "bg-gray-700 text-gray-200";
  if (score >= 60) cls = "bg-red-900 text-red-200";
  else if (score >= 30) cls = "bg-amber-900 text-amber-200";
  else if (score > 0) cls = "bg-emerald-900 text-emerald-200";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{Math.round(score)}</span>;
}

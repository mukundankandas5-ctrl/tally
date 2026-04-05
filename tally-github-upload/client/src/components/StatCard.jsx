export default function StatCard({ label, value, tone = "default", caption }) {
  const toneClasses = {
    default: "from-white to-slate-50 border-slate-200",
    teal: "from-teal-50 to-white border-teal-100",
    amber: "from-amber-50 to-white border-amber-100",
    rose: "from-rose-50 to-white border-rose-100",
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 ${toneClasses[tone] || toneClasses.default}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      {caption ? <div className="mt-2 text-sm text-slate-500">{caption}</div> : null}
    </div>
  );
}

export default function StatCard({ label, value, tone = "default", caption }) {
  const toneClasses = {
    default: "from-white/70 to-white/45 border-white/60",
    teal: "from-teal-50/70 to-white/45 border-teal-100/70",
    amber: "from-amber-50/70 to-white/45 border-amber-100/70",
    rose: "from-rose-50/70 to-white/45 border-rose-100/70",
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 backdrop-blur-xl shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${toneClasses[tone] || toneClasses.default}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      {caption ? <div className="mt-2 text-sm text-slate-500">{caption}</div> : null}
    </div>
  );
}

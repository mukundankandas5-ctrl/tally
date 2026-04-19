export default function StatCard({ label, value, tone = "default", caption }) {
  const toneClasses = {
    default: "from-white/75 to-white/50 border-white/80 hover:from-white/85 hover:to-white/60",
    teal: "from-teal-50/75 to-white/50 border-teal-100/80 hover:from-teal-50/85 hover:to-white/60",
    amber: "from-amber-50/75 to-white/50 border-amber-100/80 hover:from-amber-50/85 hover:to-white/60",
    rose: "from-rose-50/75 to-white/50 border-rose-100/80 hover:from-rose-50/85 hover:to-white/60",
  };

  return (
    <div className={`fade-in-scale rounded-24 border bg-gradient-to-br p-6 backdrop-blur-lg shadow-lg hover:shadow-xl transition-smooth hover:scale-105 cursor-default ${toneClasses[tone] || toneClasses.default}`}>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 opacity-80">{label}</div>
      <div className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
      {caption ? (
        <div className="mt-3 text-sm text-slate-600 font-medium">{caption}</div>
      ) : null}
    </div>
  );
}

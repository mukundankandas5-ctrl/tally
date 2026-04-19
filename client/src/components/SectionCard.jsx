export default function SectionCard({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`glass-card fade-in-up rounded-[24px] border border-white/75 p-8 shadow-lg hover:shadow-xl ${className}`}>
      <div className="flex flex-col gap-4 border-b border-white/40 pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-3 transition-smooth">{actions}</div>
        ) : null}
      </div>
      <div className="mt-8 transition-smooth">{children}</div>
    </section>
  );
}

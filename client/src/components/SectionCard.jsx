export default function SectionCard({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`panel-blur animate-rise rounded-[28px] border border-white/80 p-6 shadow-panel ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-display text-2xl text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

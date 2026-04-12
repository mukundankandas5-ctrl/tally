import { cn } from "../utils/formatters";

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaAction, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-6 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]">
        {Icon ? <Icon className="h-6 w-6" /> : null}
      </div>
      <div className="mt-4 text-base font-medium text-[#111827]">{title}</div>
      <div className="mt-2 max-w-sm text-sm text-[#6B7280]">{description}</div>
      {ctaLabel && ctaAction && (
        <button
          onClick={ctaAction}
          className="mt-6 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

export default function WorkflowTabButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-5 py-4 text-left transition duration-200 ${
        active
          ? "border-sea bg-sea text-white shadow-panel"
          : "border-white/70 bg-white/70 text-slate-700 hover:border-teal-200 hover:bg-white"
      }`}
    >
      <div className="text-base font-semibold">{title}</div>
      <div className={`mt-1 text-sm ${active ? "text-teal-50" : "text-slate-500"}`}>{description}</div>
    </button>
  );
}

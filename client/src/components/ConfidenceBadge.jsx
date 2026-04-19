import { confidenceClassNames } from "../utils/formatters";

export default function ConfidenceBadge({ confidence = "medium" }) {
  const safeConfidence = confidenceClassNames[confidence] ? confidence : "medium";

  return (
    <span
      className={`inline-flex fade-in-scale rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ring-1 backdrop-blur-md shadow-md hover:shadow-lg transition-smooth ${confidenceClassNames[safeConfidence]}`}
    >
      {safeConfidence}
    </span>
  );
}

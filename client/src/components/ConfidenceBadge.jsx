import { confidenceClassNames } from "../utils/formatters";

export default function ConfidenceBadge({ confidence = "medium" }) {
  const safeConfidence = confidenceClassNames[confidence] ? confidence : "medium";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ring-1 ${confidenceClassNames[safeConfidence]}`}
    >
      {safeConfidence}
    </span>
  );
}

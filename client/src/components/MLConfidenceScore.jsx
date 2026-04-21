import { useState } from "react";

export default function MLConfidenceScore({ confidence = 0, breakdown = null, showDetails = false }) {
  const [showBreakdown, setShowBreakdown] = useState(showDetails);

  const getConfidenceColor = (score) => {
    if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  const getConfidenceIcon = (score) => {
    if (score >= 80) return "✓";
    if (score >= 60) return "⚠";
    return "✗";
  };

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="inline-block">
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold border transition cursor-pointer hover:shadow-md ${getConfidenceColor(confidencePercent)}`}
        title={`ML Confidence: ${confidencePercent}%`}
      >
        <span>{getConfidenceIcon(confidencePercent)}</span>
        <span>{confidencePercent}%</span>
      </button>

      {showBreakdown && breakdown && (
        <div className="absolute z-10 mt-2 min-w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <h4 className="mb-3 text-xs font-semibold text-slate-900">Confidence Breakdown</h4>
          <div className="space-y-2">
            {breakdown.learnedRules !== undefined && (
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Learned Rules</span>
                  <span className="font-semibold text-slate-900">{Math.round(breakdown.learnedRules * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.round(breakdown.learnedRules * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {breakdown.patterns !== undefined && (
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Pattern Match</span>
                  <span className="font-semibold text-slate-900">{Math.round(breakdown.patterns * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-teal-500"
                    style={{ width: `${Math.round(breakdown.patterns * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {breakdown.anthropic !== undefined && (
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Claude AI</span>
                  <span className="font-semibold text-slate-900">{Math.round(breakdown.anthropic * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${Math.round(breakdown.anthropic * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {breakdown.ensembleConsensus !== undefined && (
              <div className="mt-3 rounded bg-slate-50 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Ensemble Vote:</span>
                  <span className="font-semibold">{breakdown.ensembleConsensus ? "✓ Consensus" : "⚠ Disagreement"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

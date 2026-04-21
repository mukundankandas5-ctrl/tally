import { useState } from "react";

export default function AnomalyWarningBadge({ anomalies = [], riskScore = 0 }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!anomalies || anomalies.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
        ✓ Clean
      </span>
    );
  }

  const highSeverityCount = anomalies.filter((a) => a.severity > 0.7).length;
  const mediumSeverityCount = anomalies.filter((a) => a.severity > 0.4 && a.severity <= 0.7).length;

  const getRiskColor = () => {
    if (riskScore > 0.7) return "bg-rose-100 text-rose-800 border-rose-300";
    if (riskScore > 0.4) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getRiskLabel = () => {
    if (riskScore > 0.7) return "🔴 High Risk";
    if (riskScore > 0.4) return "🟡 Medium Risk";
    return "🔵 Low Risk";
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold border transition cursor-pointer hover:shadow-md ${getRiskColor()}`}
        title="Click to see anomaly details"
      >
        <span>⚠</span>
        <span>{anomalies.length} anomal{anomalies.length !== 1 ? "ies" : "y"}</span>
      </button>

      {showDetails && (
        <div className="absolute z-10 mt-2 min-w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900">Anomaly Analysis</h4>
            <button
              onClick={() => setShowDetails(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {/* Risk Score */}
          <div className="mb-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">{getRiskLabel()}</span>
              <span className="text-xs font-bold text-slate-900">{Math.round(riskScore * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded overflow-hidden">
              <div
                className={`h-full ${
                  riskScore > 0.7
                    ? "bg-rose-500"
                    : riskScore > 0.4
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${Math.round(riskScore * 100)}%` }}
              />
            </div>
          </div>

          {/* Severity Summary */}
          {highSeverityCount > 0 && (
            <div className="mb-2 text-xs">
              <span className="inline-block rounded-full bg-rose-100 px-2 py-1 text-rose-800 font-semibold">
                {highSeverityCount} High Severity
              </span>
            </div>
          )}
          {mediumSeverityCount > 0 && (
            <div className="mb-3 text-xs">
              <span className="inline-block rounded-full bg-amber-100 px-2 py-1 text-amber-800 font-semibold">
                {mediumSeverityCount} Medium Severity
              </span>
            </div>
          )}

          {/* Anomaly Details */}
          <div className="space-y-2 mt-3 pt-3 border-t border-slate-200">
            {anomalies.map((anomaly, idx) => (
              <div key={idx} className="rounded-lg bg-slate-50 p-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-900">
                    {anomaly.type.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">{anomaly.message}</p>
                {anomaly.details && (
                  <p className="text-slate-500 text-xs mt-1">📊 {anomaly.details}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        anomaly.severity > 0.7
                          ? "bg-rose-500"
                          : anomaly.severity > 0.4
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.round(anomaly.severity * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 min-w-fit">
                    {Math.round(anomaly.severity * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recommended Action */}
          <div className="mt-3 rounded-lg bg-blue-50 p-2 text-xs border border-blue-200">
            <p className="font-semibold text-blue-900 mb-1">💡 Recommended Action</p>
            <p className="text-blue-800">
              {riskScore > 0.7
                ? "Manual review required before export"
                : riskScore > 0.4
                  ? "Review recommended"
                  : "Transaction looks normal, but noted for reference"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

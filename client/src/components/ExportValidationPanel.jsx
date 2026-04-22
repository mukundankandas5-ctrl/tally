import React, { useState } from "react";
import { validateForExport, validateMLBatch } from "../utils/api";
import SectionCard from "./SectionCard";

export default function ExportValidationPanel({
  analysisId,
  transactions,
  config,
  onValidationComplete,
}) {
  const [validations, setValidations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use ML batch validation instead of legacy validation
      const result = await validateMLBatch(transactions);
      if (result.success) {
        setValidations(result);
        if (onValidationComplete) {
          onValidationComplete(result);
        }
      } else {
        setError(result.error || "Validation failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!validations) {
    return (
      <SectionCard title="Pre-Export Validation">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Validate transactions before exporting to Tally. This will check ML confidence, anomalies, and export readiness.
          </p>
          <button
            onClick={handleValidate}
            disabled={loading || !transactions || transactions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Validating..." : "Run ML Validation"}
          </button>
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  // ML validation summary
  const summary = validations.validationSummary || {};
  const recommendations = validations.recommendations || [];
  const requiresReview = validations.requiresReview || [];

  return (
    <SectionCard title="ML Batch Validation Results" className="border-teal-200 bg-teal-50">
      <div className="space-y-4">
        {/* Confidence Distribution */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <p className="text-emerald-900 font-semibold">{summary.highConfidence || 0}</p>
            <p className="text-emerald-700 text-xs">High Confidence</p>
          </div>
          <div className="p-3 bg-amber-100 rounded-lg">
            <p className="text-amber-900 font-semibold">{summary.mediumConfidence || 0}</p>
            <p className="text-amber-700 text-xs">Medium Confidence</p>
          </div>
          <div className="p-3 bg-rose-100 rounded-lg">
            <p className="text-rose-900 font-semibold">{summary.lowConfidence || 0}</p>
            <p className="text-rose-700 text-xs">Low Confidence</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <p className="text-blue-900 font-semibold">{summary.withAnomalies || 0}</p>
            <p className="text-blue-700 text-xs">Anomalies</p>
          </div>
        </div>

        {/* Export Readiness */}
        <div className="p-3 bg-white border border-teal-200 rounded-lg">
          <p className="text-teal-900 font-semibold">{validations.exportReadiness}</p>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          {recommendations.map((rec, idx) => (
            <div key={idx} className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              rec.severity === "high"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : rec.severity === "medium"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}>
              {rec.message}
            </div>
          ))}
        </div>

        {/* Transactions Requiring Review */}
        {requiresReview.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-rose-900 mb-2">
              Transactions Requiring Review
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {requiresReview.map((tx, idx) => (
                <div key={idx} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
                  <span className="font-semibold">ID:</span> {tx.transaction_id || tx.id} |{" "}
                  <span className="font-semibold">Confidence:</span> {Math.round((tx.confidence || 0) * 100)}%
                  {tx.anomalies?.isAnomalous && (
                    <span className="ml-2 text-rose-700 font-semibold">Anomaly Detected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

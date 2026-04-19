import React, { useState } from "react";
import { validateForExport } from "../utils/api";
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
      const result = await validateForExport(analysisId, config?.ledgerHeads || []);
      if (result.success) {
        setValidations(result);
        if (onValidationComplete) {
          onValidationComplete(result);
        }
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
            Validate transactions before exporting to Tally
          </p>
          <button
            onClick={handleValidate}
            disabled={loading || !analysisId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Validating..." : "Run Validation"}
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

  const issues = validations?.details?.issues || [];
  const errorCount = issues.filter(
    (i) => i.severity === "error"
  ).length;
  const warningCount = issues.filter(
    (i) => i.severity === "warning"
  ).length;
  const infoCount = issues.filter(
    (i) => i.severity === "info"
  ).length;

  const issuesByType = (severity) =>
    issues.filter((i) => i.severity === severity);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getSeverityTextColor = (severity) => {
    switch (severity) {
      case "error":
        return "text-red-700";
      case "warning":
        return "text-yellow-700";
      default:
        return "text-blue-700";
    }
  };

  const canExport = errorCount === 0;

  return (
    <SectionCard
      title="Pre-Export Validation Results"
      className={
        canExport
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }
    >
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          {errorCount > 0 && (
            <div className="p-3 bg-red-100 rounded-lg">
              <p className="text-red-900 font-semibold">{errorCount} Errors</p>
              <p className="text-red-700 text-xs">Must fix before export</p>
            </div>
          )}
          {warningCount > 0 && (
            <div className="p-3 bg-yellow-100 rounded-lg">
              <p className="text-yellow-900 font-semibold">
                {warningCount} Warnings
              </p>
              <p className="text-yellow-700 text-xs">Review recommended</p>
            </div>
          )}
          {infoCount > 0 && (
            <div className="p-3 bg-blue-100 rounded-lg">
              <p className="text-blue-900 font-semibold">{infoCount} Info</p>
              <p className="text-blue-700 text-xs">FYI items</p>
            </div>
          )}
          {errorCount === 0 && warningCount === 0 && infoCount === 0 && (
            <div className="p-3 bg-green-100 rounded-lg col-span-3">
              <p className="text-green-900 font-semibold">✓ All checks passed!</p>
              <p className="text-green-700 text-xs">Ready to export</p>
            </div>
          )}
        </div>

        {/* Issues by Severity */}
        {["error", "warning", "info"].map((severity) => {
          const issues = issuesByType(severity);
          if (issues.length === 0) return null;

          return (
            <div key={severity} className="space-y-2">
              <h3 className="text-sm font-semibold capitalize text-gray-700">
                {severity === "error"
                  ? "Errors"
                  : severity === "warning"
                    ? "Warnings"
                    : "Information"}
              </h3>
              <div className="space-y-2">
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 ${getSeverityColor(
                      severity
                    )}`}
                  >
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() =>
                        setExpandedIssue(
                          expandedIssue === idx ? null : idx
                        )
                      }
                    >
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${getSeverityTextColor(
                            severity
                          )}`}
                        >
                          {issue.type}
                        </p>
                        {issue.transactionCount > 0 && (
                          <p
                            className={`text-xs mt-1 ${getSeverityTextColor(
                              severity
                            )}`}
                          >
                            Affects {issue.transactionCount} transaction
                            {issue.transactionCount !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-400">
                        {expandedIssue === idx ? "−" : "+"}
                      </span>
                    </div>

                    {expandedIssue === idx && (
                      <div className="mt-2 text-xs text-gray-700 bg-white bg-opacity-50 p-2 rounded">
                        <p>{issue.message}</p>
                        {issue.suggestion && (
                          <p className="mt-1 italic text-gray-600">
                            💡 {issue.suggestion}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Export Button */}
        <div className="pt-4 border-t">
          <button
            disabled={!canExport}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition ${
              canExport
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            {canExport ? "✓ Ready to Export" : "Fix Errors to Export"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

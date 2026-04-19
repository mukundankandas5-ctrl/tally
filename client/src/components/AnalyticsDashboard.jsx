import React, { useState, useEffect, useMemo } from "react";
import { getStatementMetrics, getAnalytics } from "../utils/api";
import SectionCard from "./SectionCard";

export default function AnalyticsDashboard({
  clientId,
  analysisId,
  statement,
  dateRange = 30,
}) {
  const [metrics, setMetrics] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("statement");

  useEffect(() => {
    if (analysisId || clientId) {
      loadAnalytics();
    }
  }, [analysisId, clientId, dateRange, statement]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      if (analysisId) {
        const result = await getStatementMetrics(statement, clientId, analysisId);
        if (result.success) {
          setMetrics(result.metrics);
        }
      }

      if (clientId) {
        const result = await getAnalytics(clientId, dateRange);
        if (result.success) {
          setAnalyticsData(result.analytics);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!metrics && !analyticsData) {
    return (
      <SectionCard title="Analytics">
        <p className="text-sm text-gray-600">
          {loading
            ? "Loading analytics..."
            : "No data available"}
        </p>
      </SectionCard>
    );
  }

  const analyticsSummary = useMemo(() => {
    const rows = Array.isArray(analyticsData) ? analyticsData : [];
    return rows.map((row) => ({
      key: row.metric_type,
      label: String(row.metric_type || "metric").replace(/_/g, " "),
      count: Number(row.count || 0),
      average: Number(row.avg_value || 0),
    }));
  }, [analyticsData]);

  return (
    <SectionCard title="Analytics Dashboard" className="lg:col-span-2">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        {metrics && analyticsData && (
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab("statement")}
              className={`px-4 py-2 font-semibold text-sm ${
                activeTab === "statement"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Current Statement
            </button>
            <button
              onClick={() => setActiveTab("trending")}
              className={`px-4 py-2 font-semibold text-sm ${
                activeTab === "trending"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Trending
            </button>
          </div>
        )}

        {/* Statement Metrics */}
        {activeTab === "statement" && metrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs text-blue-600">Transactions</p>
                <p className="text-lg font-bold text-blue-900">{metrics.totals?.transactions || 0}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs text-rose-600">Debit</p>
                <p className="text-lg font-bold text-rose-900">₹{Number(metrics.totals?.debits || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Credit</p>
                <p className="text-lg font-bold text-emerald-900">₹{Number(metrics.totals?.credits || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3">
                <p className="text-xs text-violet-600">Reviewed</p>
                <p className="text-lg font-bold text-violet-900">
                  {Math.round(((metrics.status?.reviewed || 0) / Math.max(metrics.totals?.transactions || 1, 1)) * 100)}%
                </p>
              </div>
            </div>

            {metrics.confidence && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Confidence Distribution
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "High", key: "high" },
                    { label: "Medium", key: "medium" },
                    { label: "Low", key: "low" },
                  ].map(({ label, key }) => {
                    const count = metrics.confidence[key] || 0;
                    const percentage =
                      ((count / Math.max(metrics.totals?.transactions || 1, 1)) * 100).toFixed(1);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700 w-24">
                          {label}
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              key === "high" ? "bg-green-500" : key === "medium" ? "bg-blue-500" : "bg-red-500"
                            }`}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">
                          {percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {metrics.learning && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Learning Sources
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm font-semibold text-blue-900">
                      {metrics.learning.fromLearnedRules || 0}
                    </p>
                    <p className="text-xs text-blue-700">
                      From Rules
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <p className="text-sm font-semibold text-purple-900">
                      {metrics.learning.manual || 0}
                    </p>
                    <p className="text-xs text-purple-700">
                      Manual Entries
                    </p>
                  </div>
                </div>
              </div>
            )}

            {metrics.vouchers && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Voucher Types
                </h3>
                <div className="space-y-2">
                  {Object.entries(metrics.vouchers).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-gray-700">{type}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {metrics.quality && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Quality Indicators
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      Avg Confidence
                    </span>
                    <span className="font-semibold text-blue-600">
                      {(Number(metrics.confidence?.average || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      Flagged for Review
                    </span>
                    <span className="font-semibold text-orange-600">
                      {metrics.quality.flagged || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      Review Required
                    </span>
                    <span className="font-semibold text-slate-700">{metrics.quality.reviewRequired}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trending Data */}
        {activeTab === "trending" && analyticsData && (
          <div className="space-y-4">
            {analyticsSummary.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {analyticsSummary.map((metric) => (
                    <div key={metric.key} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{metric.count}</p>
                      <p className="text-xs text-slate-600">Avg {metric.average.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-blue-900">Insights</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    {analyticsSummary.map((metric) => (
                      <li key={`insight-${metric.key}`}>
                        {metric.label}: {metric.count} records logged in the last {dateRange} days with average value {metric.average.toFixed(2)}.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

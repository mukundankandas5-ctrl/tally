import React, { useState, useEffect } from "react";
import SectionCard from "./SectionCard";

export default function RuleDashboard({ clientId, mappingRules = [] }) {
  const [rules, setRules] = useState(mappingRules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("confidence");
  const [showDetails, setShowDetails] = useState(null);

  useEffect(() => {
    setRules(mappingRules);
  }, [mappingRules]);

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    if (filterType === "all") return true;
    if (filterType === "enabled") return rule.enabled !== false;
    if (filterType === "disabled") return rule.enabled === false;
    if (filterType === "learned") return rule.source === "learned";
    if (filterType === "manual") return rule.source === "manual";
    return true;
  });

  // Sort rules
  const sortedRules = [...filteredRules].sort((a, b) => {
    if (sortBy === "confidence") {
      return (b.confidence || 0) - (a.confidence || 0);
    }
    if (sortBy === "usage") {
      return (b.usageCount || 0) - (a.usageCount || 0);
    }
    if (sortBy === "recent") {
      return (
        new Date(b.lastUsed || 0).getTime() -
        new Date(a.lastUsed || 0).getTime()
      );
    }
    return 0;
  });

  const getSourceBadge = (source) => {
    if (source === "learned") {
      return (
        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
          Learned
        </span>
      );
    }
    return (
      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
        Manual
      </span>
    );
  };

  const getStatusBadge = (enabled) => {
    return enabled !== false ? (
      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
        Active
      </span>
    ) : (
      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
        Disabled
      </span>
    );
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return "text-green-700";
    if (confidence >= 0.75) return "text-blue-700";
    if (confidence >= 0.6) return "text-yellow-700";
    return "text-red-700";
  };

  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.enabled !== false).length,
    learned: rules.filter((r) => r.source === "learned").length,
    avgConfidence:
      rules.length > 0
        ? (rules.reduce((sum, r) => sum + (r.confidence || 0), 0) /
            rules.length)
            .toFixed(2)
        : 0,
    totalUsage: rules.reduce((sum, r) => sum + (r.usageCount || 0), 0),
  };

  return (
    <SectionCard title="Mapping Rules Dashboard" className="lg:col-span-2">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600">Total Rules</p>
            <p className="text-lg font-bold text-blue-900">
              {stats.total}
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-green-600">Active</p>
            <p className="text-lg font-bold text-green-900">
              {stats.active}
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-xs text-purple-600">Learned</p>
            <p className="text-lg font-bold text-purple-900">
              {stats.learned}
            </p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-600">Avg Confidence</p>
            <p className="text-lg font-bold text-yellow-900">
              {(stats.avgConfidence * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-orange-600">Total Uses</p>
            <p className="text-lg font-bold text-orange-900">
              {stats.totalUsage}
            </p>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">
              Filter:
            </label>
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value)
              }
              className="px-3 py-1 border rounded text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Rules</option>
              <option value="enabled">Active Only</option>
              <option value="disabled">Disabled Only</option>
              <option value="learned">
                Learned Rules
              </option>
              <option value="manual">Manual Rules</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value)
              }
              className="px-3 py-1 border rounded text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="confidence">
                Confidence
              </option>
              <option value="usage">Usage Count</option>
              <option value="recent">Last Used</option>
            </select>
          </div>

          <div className="flex-1 text-right text-xs text-gray-600">
            Showing {sortedRules.length} of {rules.length}{" "}
            rules
          </div>
        </div>

        {/* Rules Table */}
        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          {sortedRules.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No rules match your filter
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b sticky top-0">
                <tr>
                  <th className="text-left p-3 font-semibold">
                    Pattern
                  </th>
                  <th className="text-center p-3 font-semibold">
                    Confidence
                  </th>
                  <th className="text-center p-3 font-semibold">
                    Usage
                  </th>
                  <th className="text-center p-3 font-semibold">
                    Type
                  </th>
                  <th className="text-center p-3 font-semibold">
                    Status
                  </th>
                  <th className="text-center p-3 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRules.map((rule, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-semibold text-gray-800">
                          {rule.pattern ||
                            rule.narrationPattern ||
                            "Unnamed Rule"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {rule.debitAccount || "Any"} →{" "}
                          {rule.creditAccount || "Any"}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-bold ${getConfidenceColor(
                            rule.confidence
                          )}`}
                        >
                          {(
                            (rule.confidence || 0) * 100
                          ).toFixed(0)}
                          %
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-semibold">
                          {rule.usageCount || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {getSourceBadge(rule.source)}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(rule.enabled)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() =>
                            setShowDetails(
                              showDetails === idx
                                ? null
                                : idx
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                        >
                          {showDetails === idx
                            ? "Hide"
                            : "View"}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Details */}
                    {showDetails === idx && (
                      <tr className="bg-blue-50 border-b">
                        <td colSpan="6" className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            {rule.lastUsed && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700">
                                  Last Used
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date(
                                    rule.lastUsed
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                            {rule.createdAt && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700">
                                  Created
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date(
                                    rule.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                            {rule.description && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-gray-700">
                                  Description
                                </p>
                                <p className="text-sm text-gray-600">
                                  {rule.description}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                              Edit
                            </button>
                            <button className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500">
                              {rule.enabled !==
                              false
                                ? "Disable"
                                : "Enable"}
                            </button>
                            <button className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Effectiveness Insights */}
        {rules.length > 0 && (
          <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50">
            <h3 className="font-semibold text-sm mb-2">
              💡 Rules Insights
            </h3>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>
                • Your highest performing rule has{" "}
                <strong>
                  {Math.max(
                    ...rules.map((r) => r.usageCount || 0),
                    0
                  )}
                </strong>{" "}
                uses
              </li>
              <li>
                •{" "}
                {rules.filter((r) => r.confidence >= 0.9)
                  .length}{" "}
                rules have{'>'} 90% confidence
              </li>
              <li>
                • Learned rules make up{" "}
                <strong>
                  {(
                    ((stats.learned || 0) /
                      (stats.total || 1)) *
                    100
                  ).toFixed(0)}
                </strong>
                % of your rule base
              </li>
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

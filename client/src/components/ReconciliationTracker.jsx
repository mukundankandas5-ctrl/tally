import React, { useState, useEffect } from "react";
import {
  startReconciliation,
  verifyReconciliation,
  getReconciliation,
} from "../utils/api";
import SectionCard from "./SectionCard";

export default function ReconciliationTracker({
  analysisId,
  clientId,
  totalTransactions,
  totalAmount,
}) {
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bankName, setBankName] = useState("");
  const [tallyVerificationData, setTallyVerificationData] = useState({
    transactionCount: "",
    totalAmount: "",
  });

  const loadReconciliation = async (targetAnalysisId) => {
    try {
      const result = await getReconciliation(targetAnalysisId);
      if (result.success) {
        setReconciliation(result.reconciliation);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (analysisId) {
      loadReconciliation(analysisId);
    }
  }, [analysisId]);

  const handleStartReconciliation = async () => {
    if (!analysisId || !clientId) {
      setError("Analysis and client are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await startReconciliation(
        analysisId,
        clientId,
        totalTransactions || 0,
        `${analysisId}-${totalTransactions}-${Number(totalAmount || 0).toFixed(2)}`
      );
      if (result.success) {
        await loadReconciliation(analysisId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReconciliation = async () => {
    if (
      !tallyVerificationData.transactionCount ||
      !tallyVerificationData.totalAmount
    ) {
      setError("Please fill in all verification details");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const receivedCount = parseInt(tallyVerificationData.transactionCount, 10);
      const receivedAmount = parseFloat(tallyVerificationData.totalAmount);
      const matchedEntries =
        Math.abs(receivedAmount - Number(totalAmount || 0)) < 0.01
          ? Math.min(receivedCount, totalTransactions || receivedCount)
          : Math.max(0, receivedCount - 1);
      const mismatches =
        Math.abs(receivedAmount - Number(totalAmount || 0)) < 0.01
          ? []
          : [`Expected ₹${Number(totalAmount || 0).toFixed(2)} but Tally shows ₹${receivedAmount.toFixed(2)}`];

      const result = await verifyReconciliation(analysisId, receivedCount, matchedEntries, mismatches);

      if (result.success) {
        setReconciliation(result.reconciliation);
        setTallyVerificationData({
          transactionCount: "",
          totalAmount: "",
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!reconciliation) {
    return (
      <SectionCard title="Reconciliation Tracker">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Verify statement accuracy after export to Tally</p>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Bank / Source Name
              </label>
              <input
                type="text"
                placeholder="Reference name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600">In Our System</p>
                <p className="text-sm font-semibold text-blue-900">
                  {totalTransactions || 0}
                </p>
                <p className="text-xs text-blue-600">Transactions</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-green-600">Total Amount</p>
                <p className="text-sm font-semibold text-green-900">
                  ₹{(totalAmount || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartReconciliation}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-sm"
            >
              {loading ? "Starting..." : "Start Reconciliation"}
            </button>
          </div>
        </div>
      </SectionCard>
    );
  }

  const matchPercentage =
    reconciliation.expectedCount > 0
      ? (
          (Number(reconciliation.matchedEntries || 0) /
            Number(reconciliation.expectedCount)) *
          100
        ).toFixed(1)
      : 0;

  const amountDifference = Math.abs(Number(totalAmount || 0) - Number(tallyVerificationData.totalAmount || totalAmount || 0)) || 0;

  const isMatched =
    matchPercentage === "100" &&
    amountDifference < 0.01 &&
    !reconciliation.mismatches?.length;

  return (
    <SectionCard
      title="Reconciliation Status"
      className={
        isMatched
          ? "border-green-200 bg-green-50"
          : "border-orange-200 bg-orange-50"
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isMatched
                ? "bg-green-200 text-green-800"
                : reconciliation.status ===
                    "verified"
                  ? "bg-blue-200 text-blue-800"
                  : "bg-yellow-200 text-yellow-800"
            }`}
          >
            {reconciliation.status === "verified"
              ? "✓ Reconciliation Complete"
              : reconciliation.status ===
                  "failed"
                ? "✗ Discrepancies Found"
                : "In Progress"}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-600">
              Transaction Match
            </p>
            <p
              className={`text-lg font-bold ${
                matchPercentage === "100"
                  ? "text-green-600"
                  : "text-orange-600"
              }`}
            >
              {matchPercentage}%
            </p>
            <p className="text-xs text-gray-600">
              {reconciliation.matchedEntries || 0} of{" "}
              {reconciliation.expectedCount}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-600">Amount Diff</p>
            <p
              className={`text-lg font-bold ${
                amountDifference < 0.01
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              ₹{amountDifference.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600">
              {amountDifference < 0.01
                ? "Balanced"
                : "Out of balance"}
            </p>
          </div>
        </div>

        {/* Details */}
        {reconciliation.status !== "pending" && (
          <div className="border rounded-lg p-3 bg-white space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Expected</span>
              <span className="font-semibold">
                {
                  reconciliation.expectedCount
                }
                 txns, ₹
                {(Number(totalAmount || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Received</span>
              <span className="font-semibold">
                {reconciliation.receivedCount || "--"} txns,
                ₹{(Number(tallyVerificationData.totalAmount || totalAmount || 0)).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Verification Form (if not yet verified) */}
        {reconciliation.status !== "verified" && (
          <div className="border rounded-lg p-4 bg-white space-y-3">
            <h3 className="font-semibold text-sm">
              Enter Tally Verification Data
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Transaction Count from Tally
              </label>
              <input
                type="number"
                value={
                  tallyVerificationData.transactionCount
                }
                onChange={(e) =>
                  setTallyVerificationData({
                    ...tallyVerificationData,
                    transactionCount: e.target.value,
                  })
                }
                placeholder="e.g., 142"
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Total Amount from Tally
              </label>
              <input
                type="number"
                step="0.01"
                value={tallyVerificationData.totalAmount}
                onChange={(e) =>
                  setTallyVerificationData({
                    ...tallyVerificationData,
                    totalAmount: e.target.value,
                  })
                }
                placeholder="e.g., 45000.50"
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleVerifyReconciliation}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold text-sm"
            >
              {loading ? "Verifying..." : "Verify & Complete"}
            </button>
          </div>
        )}

        {/* Discrepancies */}
        {reconciliation.mismatches &&
          reconciliation.mismatches.length > 0 && (
            <div className="border border-red-300 rounded-lg p-3 bg-red-50">
              <p className="font-semibold text-red-900 text-sm mb-2">
                Discrepancies Found:
              </p>
              <ul className="space-y-1 text-xs text-red-800">
                {reconciliation.mismatches.map(
                  (disc, idx) => (
                    <li key={idx}>• {disc}</li>
                  )
                )}
              </ul>
            </div>
          )}
      </div>
    </SectionCard>
  );
}

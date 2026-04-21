import { useEffect, useState } from "react";
import { classifyBatchTransactions, detectAnomalies } from "../utils/api";

export default function ProgressiveMLClassifier({ 
  transactions = [], 
  onClassificationComplete,
  autoStart = true 
}) {
  const [isClassifying, setIsClassifying] = useState(autoStart && transactions.length > 0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing ML classification...");
  const [classifiedTransactions, setClassifiedTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    anomaliesDetected: 0,
  });

  useEffect(() => {
    if (!isClassifying || transactions.length === 0) return;

    const runClassification = async () => {
      try {
        setError(null);
        setProgress(10);
        setStatus("Running ML classification on batch...");

        // Classify all transactions at once
        const classifyResult = await classifyBatchTransactions(transactions);

        if (!classifyResult.success) {
          throw new Error(classifyResult.message || "Classification failed");
        }

        const classified = classifyResult.classifications || [];
        setProgress(50);
        setStatus("Detecting anomalies...");

        // Detect anomalies for each transaction in parallel
        const anomalyPromises = classified.map((transaction) =>
          detectAnomalies(transaction)
            .then((result) => ({
              ...transaction,
              anomalies: result.anomalies || [],
              riskScore: result.riskScore || 0,
            }))
            .catch((err) => {
              console.error("Anomaly detection failed for transaction:", transaction.id, err);
              return {
                ...transaction,
                anomalies: [],
                riskScore: 0,
              };
            })
        );

        const enhancedTransactions = await Promise.all(anomalyPromises);

        setProgress(95);
        setStatus("Computing statistics...");

        // Compute statistics
        const newStats = {
          totalProcessed: enhancedTransactions.length,
          highConfidence: enhancedTransactions.filter((t) => t.mlConfidence >= 0.8).length,
          mediumConfidence: enhancedTransactions.filter((t) => t.mlConfidence >= 0.6 && t.mlConfidence < 0.8).length,
          lowConfidence: enhancedTransactions.filter((t) => t.mlConfidence < 0.6).length,
          anomaliesDetected: enhancedTransactions.filter((t) => t.anomalies && t.anomalies.length > 0).length,
        };

        setStats(newStats);
        setClassifiedTransactions(enhancedTransactions);

        setProgress(100);
        setStatus(
          `✓ Classification complete! ${newStats.highConfidence} high confidence, ${newStats.mediumConfidence} medium, ${newStats.lowConfidence} low.`
        );

        // Call callback to update parent component
        if (onClassificationComplete) {
          onClassificationComplete(enhancedTransactions);
        }

        setIsClassifying(false);
      } catch (err) {
        setError(err.message || "Classification failed. Please check the console for details.");
        setProgress(0);
        setStatus("Classification failed");
        setIsClassifying(false);
      }
    };

    runClassification();
  }, [isClassifying, transactions]);

  if (!isClassifying && error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">❌</span>
          <h3 className="font-semibold text-rose-900">Classification Error</h3>
        </div>
        <p className="text-sm text-rose-800 mb-3">{error}</p>
        <button
          onClick={() => setIsClassifying(true)}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isClassifying && classifiedTransactions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-teal-900">ML Classification Status</h3>
          <span className="text-sm font-semibold text-teal-700">{progress}%</span>
        </div>
        <div className="h-2 bg-teal-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-teal-800 mb-4">{status}</p>

      {!isClassifying && stats.totalProcessed > 0 && (
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-lg bg-white p-2 text-center">
            <p className="text-xs text-slate-600">Total</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalProcessed}</p>
          </div>
          <div className="rounded-lg bg-emerald-100 p-2 text-center">
            <p className="text-xs text-emerald-700">High Conf.</p>
            <p className="text-lg font-bold text-emerald-900">{stats.highConfidence}</p>
          </div>
          <div className="rounded-lg bg-amber-100 p-2 text-center">
            <p className="text-xs text-amber-700">Medium Conf.</p>
            <p className="text-lg font-bold text-amber-900">{stats.mediumConfidence}</p>
          </div>
          <div className="rounded-lg bg-rose-100 p-2 text-center">
            <p className="text-xs text-rose-700">Low Conf.</p>
            <p className="text-lg font-bold text-rose-900">{stats.lowConfidence}</p>
          </div>
          <div className="rounded-lg bg-blue-100 p-2 text-center">
            <p className="text-xs text-blue-700">Anomalies</p>
            <p className="text-lg font-bold text-blue-900">{stats.anomaliesDetected}</p>
          </div>
        </div>
      )}

      {isClassifying && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
          <p className="text-xs text-teal-700">Processing transactions...</p>
        </div>
      )}
    </div>
  );
}

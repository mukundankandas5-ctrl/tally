import React, { useState, useEffect } from "react";
import {
  detectDuplicates,
  getDuplicates,
} from "../utils/api";
import SectionCard from "./SectionCard";

export default function DuplicateDetectionPanel({
  analysisId,
  transactions,
  onDuplicateResolved,
}) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    if (analysisId) {
      loadDuplicates();
    }
  }, [analysisId]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDuplicates(analysisId);
      if (result.success) {
        setDuplicates(result.duplicates || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await detectDuplicates(analysisId, 2);
      if (result.success) {
        setDuplicates(result.duplicates || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDuplicate = (duplicateId, resolution) => {
    setResolvedCount(resolvedCount + 1);
    setDuplicates(
      duplicates.filter((d) => d.id !== duplicateId)
    );
    if (onDuplicateResolved) {
      onDuplicateResolved(duplicateId, resolution);
    }
  };

  if (!analysisId || duplicates.length === 0) {
    return (
      <SectionCard title="Duplicate Detection">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {duplicates.length === 0 && analysisId
              ? "No duplicates detected"
              : "Run analysis first"}
          </p>
          <button
            onClick={handleDetectDuplicates}
            disabled={loading || !analysisId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Detecting..." : "Detect Duplicates"}
          </button>
          {resolvedCount > 0 && (
            <p className="text-sm text-green-600">
              Resolved {resolvedCount} duplicates
            </p>
          )}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Duplicate Detection (${duplicates.length} found)`}
      className="border-orange-200 bg-orange-50"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        )}

        {duplicates.map((duplicate) => (
          <div
            key={duplicate.id}
            className="border border-orange-300 rounded-lg p-4 bg-white"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-sm">
                  Match Score: {(duplicate.matchScore * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {duplicate.reason}
                </p>
              </div>
              <button
                onClick={() =>
                  setSelectedDuplicate(
                    selectedDuplicate?.id === duplicate.id
                      ? null
                      : duplicate
                  )
                }
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                {selectedDuplicate?.id === duplicate.id
                  ? "Hide"
                  : "Details"}
              </button>
            </div>

            {selectedDuplicate?.id === duplicate.id && (
              <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-gray-700">Transaction 1</p>
                    <p className="text-gray-600">
                      {duplicate.transaction1?.narration}
                    </p>
                    <p className="text-gray-600">
                      Amount: ₹{duplicate.transaction1?.amount}
                    </p>
                    <p className="text-gray-600">
                      Date: {duplicate.transaction1?.date}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Transaction 2</p>
                    <p className="text-gray-600">
                      {duplicate.transaction2?.narration}
                    </p>
                    <p className="text-gray-600">
                      Amount: ₹{duplicate.transaction2?.amount}
                    </p>
                    <p className="text-gray-600">
                      Date: {duplicate.transaction2?.date}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      handleResolveDuplicate(duplicate.id, "merged")
                    }
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Merge Duplicates
                  </button>
                  <button
                    onClick={() =>
                      handleResolveDuplicate(duplicate.id, "dismissed")
                    }
                    className="flex-1 px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                  >
                    Not a Duplicate
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

import React, { useState, useEffect } from 'react';
import { getValidations } from '../utils/api';

export default function ValidationResultsPanel({ analysisId, onClose, canExport = true }) {
  const [validations, setValidations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadValidations();
  }, [analysisId]);

  const loadValidations = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getValidations(analysisId);
      setValidations(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!validations && !loading && !error) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">Loading validation results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm font-semibold text-red-700">Validation Error</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <button
          onClick={loadValidations}
          className="mt-2 text-xs px-3 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = validations?.summary || {};
  const errors = validations?.details?.issues?.filter(i => i.severity === 'error') || [];
  const warnings = validations?.details?.issues?.filter(i => i.severity === 'warning') || [];
  const infos = validations?.details?.issues?.filter(i => i.severity === 'info') || [];

  const canProceedExport = errors.length === 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Pre-Export Validation
          {!canProceedExport ? (
            <span className="ml-2 inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">
              {errors.length} errors found
            </span>
          ) : warnings.length > 0 ? (
            <span className="ml-2 inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
              {warnings.length} warnings
            </span>
          ) : (
            <span className="ml-2 inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
              Ready to export
            </span>
          )}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <h4 className="text-sm font-semibold text-red-800 mb-2">
            🚫 Errors ({errors.length}) - Export Blocked
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {errors.map((issue, idx) => (
              <div key={idx} className="text-xs text-red-700 bg-white p-2 rounded border border-red-100">
                <div className="font-medium">{issue.type}</div>
                <div className="text-red-600">{issue.message}</div>
                {issue.transactionId && (
                  <div className="text-red-500 text-xs mt-1">Transaction #{issue.transactionId}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ Warnings ({warnings.length}) - Review Recommended
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {warnings.map((issue, idx) => (
              <div key={idx} className="text-xs text-yellow-700 bg-white p-2 rounded border border-yellow-100">
                <div className="font-medium">{issue.type}</div>
                <div>{issue.message}</div>
                {issue.transactionId && (
                  <div className="text-yellow-600 text-xs mt-1">Transaction #{issue.transactionId}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {infos.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">
            ℹ️ Information ({infos.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {infos.map((issue, idx) => (
              <div key={idx} className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-100">
                <div className="font-medium">{issue.type}</div>
                <div>{issue.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length === 0 && warnings.length === 0 && infos.length === 0 && (
        <div className="p-4 text-center">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-gray-600">All validation checks passed!</p>
          <p className="text-xs text-gray-500 mt-1">This statement is ready for export.</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t">
        <button
          onClick={loadValidations}
          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
        >
          Refresh Validation
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  saveAccountMapping,
  getAccountMappings,
  deleteAccountMapping,
} from "../utils/api";
import SectionCard from "./SectionCard";

export default function AccountMapperDashboard({ clientId, onMappingChange }) {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newMapping, setNewMapping] = useState({
    debitAccount: "",
    creditAccount: "",
    confidence: 0.9,
  });
  const [filterMinFrequency, setFilterMinFrequency] = useState(0);

  useEffect(() => {
    if (clientId) {
      loadMappings();
    }
  }, [clientId]);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const result = await getAccountMappings(clientId);
      if (result.success) {
        setMappings(result.mappings || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!newMapping.debitAccount || !newMapping.creditAccount) {
      setError("Both accounts are required");
      return;
    }

    try {
      const result = await saveAccountMapping({
        clientId,
        ...newMapping,
      });

      if (result.success) {
        setNewMapping({
          debitAccount: "",
          creditAccount: "",
          confidence: 0.9,
        });
        setEditingId(null);
        await loadMappings();
        if (onMappingChange) onMappingChange();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (
      !window.confirm("Are you sure you want to delete this mapping?")
    ) {
      return;
    }

    try {
      const result = await deleteAccountMapping(mappingId);
      if (result.success) {
        await loadMappings();
        if (onMappingChange) onMappingChange();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredMappings = mappings.filter(
    (m) => (m.frequency || 1) >= filterMinFrequency
  );

  const avgConfidence =
    mappings.length > 0
      ? (
          mappings.reduce((sum, m) => sum + (m.confidence || 0), 0) /
          mappings.length
        ).toFixed(2)
      : 0;

  return (
    <SectionCard title="Account Mapper" className="lg:col-span-2">
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

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm font-semibold text-blue-900">
              {mappings.length}
            </p>
            <p className="text-xs text-blue-700">Total Mappings</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm font-semibold text-green-900">
              {avgConfidence}
            </p>
            <p className="text-xs text-green-700">Avg Confidence</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-sm font-semibold text-purple-900">
              {Math.max(
                ...mappings.map((m) => m.frequency || 0),
                0
              )}
            </p>
            <p className="text-xs text-purple-700">Max Frequency</p>
          </div>
        </div>

        {/* Add/Edit Mapping Form */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-sm mb-3">
            {editingId ? "Edit Mapping" : "Add New Mapping"}
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Debit Account (e.g., Bank Account)"
              value={newMapping.debitAccount}
              onChange={(e) =>
                setNewMapping({
                  ...newMapping,
                  debitAccount: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Credit Account (e.g., Expenses)"
              value={newMapping.creditAccount}
              onChange={(e) =>
                setNewMapping({
                  ...newMapping,
                  creditAccount: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 flex-shrink-0">
                Confidence:
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={newMapping.confidence}
                onChange={(e) =>
                  setNewMapping({
                    ...newMapping,
                    confidence: parseFloat(e.target.value),
                  })
                }
                className="flex-1"
              />
              <span className="text-sm font-semibold text-gray-900 w-12">
                {(newMapping.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveMapping}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                {editingId ? "Update" : "Add"} Mapping
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewMapping({
                      debitAccount: "",
                      creditAccount: "",
                      confidence: 0.9,
                    });
                  }}
                  className="px-4 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">Min Frequency:</label>
          <input
            type="number"
            min="0"
            max="100"
            value={filterMinFrequency}
            onChange={(e) => setFilterMinFrequency(parseInt(e.target.value))}
            className="w-20 px-2 py-1 border rounded text-sm"
          />
          <span className="text-xs text-gray-600">
            ({filteredMappings.length} of {mappings.length} shown)
          </span>
        </div>

        {/* Mappings List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredMappings.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-sm">
              {mappings.length === 0
                ? "No mappings yet. Add one above."
                : "No mappings match the filter."}
            </p>
          ) : (
            filteredMappings.map((mapping) => (
              <div
                key={mapping.id}
                className="border rounded-lg p-3 bg-white hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {mapping.debitAccount} ({mapping.creditAccount})
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-600">
                      <span>
                        Confidence: {(mapping.confidence * 100).toFixed(0)}%
                      </span>
                      {mapping.frequency && (
                        <span>Used {mapping.frequency}x</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setNewMapping(mapping);
                        setEditingId(mapping.id);
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteMapping(mapping.id)
                      }
                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
}

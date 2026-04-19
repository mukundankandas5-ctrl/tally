import React, { useState, useEffect } from "react";
import {
  assignUserToAnalysis,
  fetchAuthUsers,
  getAnalysisAssignees,
  getAuditLogs,
  recordAuditLog,
} from "../utils/api";
import SectionCard from "./SectionCard";

export default function UserAssignmentPanel({
  analysisId,
  currentUser,
  onAssignmentChange,
}) {
  const [assignees, setAssignees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    if (analysisId) {
      loadAssignees();
      loadAuditLog();
    }
    loadUsers();
  }, [analysisId]);

  const loadUsers = async () => {
    try {
      const result = await fetchAuthUsers();
      setAvailableUsers(result.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const loadAssignees = async () => {
    try {
      const result = await getAnalysisAssignees(analysisId);
      if (result.success) {
        setAssignees(result.assignees || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAuditLog = async () => {
    try {
      const result = await getAuditLogs(analysisId, 10);
      if (result.success) {
        setAuditLogs(result.logs || []);
      }
    } catch (err) {
      console.error("Error loading audit log:", err);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await assignUserToAnalysis(
        analysisId,
        selectedUserId,
        currentUser?.id || null
      );
      if (result.success) {
        await recordAuditLog(
          analysisId,
          currentUser?.id || selectedUserId,
          "Assigned analysis",
          { assignedUserId: selectedUserId },
          ""
        );
        setSelectedUserId("");
        setShowAssignForm(false);
        await loadAssignees();
        await loadAuditLog();
        if (onAssignmentChange) onAssignmentChange();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAssigneeDisplayName = (userId) => {
    const user = availableUsers.find((u) => u.id === userId);
    return user ? user.name : userId;
  };

  const getAssigneeInitials = (userId) => {
    const name = getAssigneeDisplayName(userId);
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getAvatarColor = (index) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-pink-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <SectionCard title="Team & Accountability">
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

        {/* Assigned Users */}
        <div>
          <h3 className="font-semibold text-sm mb-2">
            Assigned To ({assignees.length})
          </h3>
          {assignees.length === 0 ? (
            <p className="text-xs text-gray-600">
              No users assigned yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignees.map((assignee, idx) => (
                <div
                  key={assignee.userId ||  idx}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(
                      idx
                    )}`}
                  >
                    {getAssigneeInitials(
                      assignee.userId
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {assignee.name || getAssigneeDisplayName(assignee.userId)}
                  </span>
                  {assignee.assignedAt && (
                    <span className="text-xs text-gray-600">
                      ({new Date(
                        assignee.assignedAt
                      ).toLocaleDateString()})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign Button */}
        {!showAssignForm && (
          <button
            onClick={() => setShowAssignForm(true)}
            className="w-full px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-semibold"
          >
            + Assign to Team Member
          </button>
        )}

        {/* Assign Form */}
        {showAssignForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <h3 className="font-semibold text-sm">
              Assign Analysis
            </h3>
            <select
              value={selectedUserId}
              onChange={(e) =>
                setSelectedUserId(e.target.value)
              }
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a team member...</option>
              {availableUsers
                .filter(
                  (u) =>
                    !assignees.some(
                      (a) => a.userId === u.id
                    )
                )
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAssignUser}
                disabled={loading || !selectedUserId}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-semibold"
              >
                {loading ? "Assigning..." : "Assign"}
              </button>
              <button
                onClick={() => {
                  setShowAssignForm(false);
                  setSelectedUserId("");
                }}
                className="px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Activity/Audit Log */}
        <div className="border-t pt-4">
          <button
            onClick={() =>
              setShowAuditLog(!showAuditLog)
            }
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            {showAuditLog
              ? "▾ Recent Activity"
              : "▸ Recent Activity"}
            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
              {auditLogs.length}
            </span>
          </button>

          {showAuditLog && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-gray-600">
                  No activity yet
                </p>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 rounded text-xs border-l-2 border-blue-400"
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">
                        {log.action || "Action"}
                      </span>
                      <span className="text-gray-600">
                        {log.createdAt
                          ? new Date(
                              log.createdAt
                            ).toLocaleDateString() +
                            " " +
                            new Date(
                              log.createdAt
                            ).toLocaleTimeString()
                          : ""}
                      </span>
                    </div>
                    {log.changes && (
                      <p className="text-gray-700 mt-1">
                        {typeof log.changes === "string" ? log.changes : JSON.stringify(log.changes)}
                      </p>
                    )}
                    {log.userId && (
                      <p className="text-gray-600 mt-1">
                        By:{" "}
                        {getAssigneeDisplayName(
                          log.userId
                        )}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

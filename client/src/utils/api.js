import {
  isSupabaseEnabled,
  loginWithSupabase,
  logoutSupabaseUser,
  requestSupabasePasswordReset,
  restoreSupabaseUser,
  signupWithSupabase,
} from "./authClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function readError(response) {
  try {
    const payload = await response.json();
    return payload.message || "Request failed.";
  } catch (error) {
    return "Request failed.";
  }
}

async function fetchJson(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

async function postForm(path, formData) {
  return fetchJson(path, {
    method: "POST",
    body: formData,
  });
}

async function apiRequest(path, options = {}) {
  return fetchJson(path, options);
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function fetchLedgers() {
  return fetchJson("/api/reference/ledgers");
}

export async function fetchClients() {
  return fetchJson("/api/reference/clients");
}

export async function createClient(payload) {
  return fetchJson("/api/reference/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchDocumentRequests() {
  return fetchJson("/api/reference/document-requests");
}

export async function createDocumentRequest(payload) {
  return fetchJson("/api/reference/document-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function completeDocumentRequest(id) {
  return fetchJson(`/api/reference/document-requests/${id}/complete`, {
    method: "POST",
  });
}

export async function fetchAuthUsers() {
  return fetchJson("/api/auth/users");
}

export async function updateOnboardingStatus(userId, status) {
  return fetchJson("/api/auth/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, status }),
  });
}

export async function loginWithGoogle(credential) {
  return fetchJson("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
}

export async function loginUser(email, password) {
  if (isSupabaseEnabled()) {
    return loginWithSupabase(email, password);
  }
  return fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function signupUser(name, email, password) {
  if (isSupabaseEnabled()) {
    return signupWithSupabase(name, email, password);
  }
  return fetchJson("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function requestPasswordReset(email) {
  if (isSupabaseEnabled()) {
    return requestSupabasePasswordReset(email);
  }
  return fetchJson("/api/auth/request-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, newPassword) {
  if (isSupabaseEnabled()) {
    throw new Error("Use the password reset link from your email when Supabase Auth is enabled.");
  }
  return fetchJson("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function restoreAuthUser() {
  if (isSupabaseEnabled()) {
    return restoreSupabaseUser();
  }
  return null;
}

export async function logoutUser() {
  if (isSupabaseEnabled()) {
    await logoutSupabaseUser();
  }
}

export async function fetchTallyStatus() {
  return fetchJson("/api/tally-status");
}

export async function uploadInvoice(file, payload = {}) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return postForm("/api/invoices/extract", formData);
}

export async function downloadInvoiceXml(payload) {
  const response = await postJson("/api/invoices/export", payload);
  return response.blob();
}

export async function pushInvoiceToTally(invoice, config) {
  return fetchJson("/api/tally/push-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice, config }),
  });
}

export async function uploadBankStatement(file, payload = {}) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return postForm("/api/bank-statements/analyze", formData);
}

export async function uploadBankStatementsBulk(files, payload = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return postForm("/api/bank-statements/analyze-bulk", formData);
}

export async function downloadBankStatementXml(payload) {
  const response = await postJson("/api/bank-statements/export", payload);
  return response.blob();
}

export async function pushBankStatementToTally(statement, config) {
  return fetchJson("/api/tally/push-bank-statement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement, config }),
  });
}

export async function pushXmlToTally(xml, config = {}) {
  return fetchJson("/api/tally/push-xml", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml, config }),
  });
}

export async function analyzeRecommendations(file, payload = {}) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return postForm("/api/recommendations/analyze", formData);
}

export async function downloadRecommendationXml(payload) {
  const response = await postJson("/api/recommendations/export", payload);
  return response.blob();
}

export async function reconcileGst(gstr2bFile, purchaseRegisterFile) {
  const formData = new FormData();
  formData.append("gstrFile", gstr2bFile);
  formData.append("registerFile", purchaseRegisterFile);
  return apiRequest("/api/gst/reconcile", {
    method: "POST",
    body: formData,
  });
}

export async function fetchActivity() {
  return apiRequest("/api/activity/activities", { method: "GET" });
}

export async function fetchSyncHistory() {
  return apiRequest("/api/activity/sync-history", { method: "GET" });
}

export async function saveAnalysisHistoryItem(payload) {
  return fetchJson("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listAnalysisHistory({ clientId = null, type = null, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (clientId) params.append("clientId", clientId);
  if (type) params.append("type", type);
  params.append("limit", String(limit));
  return fetchJson(`/api/history?${params.toString()}`);
}

export async function getAnalysisHistoryItem(id) {
  return fetchJson(`/api/history/${id}`);
}

export async function downloadGstWorkbook(payload) {
  const response = await postJson("/api/gst/export", payload);
  return response.blob();
}

export async function downloadGstMismatchWorkbook(payload) {
  const response = await postJson("/api/gst/export-mismatches", payload);
  return response.blob();
}

export async function testTallyConnection(config) {
  return fetchJson("/api/tally/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function createPairingCode() {
  return fetchJson("/api/pair-device", {
    method: "POST",
  });
}

export async function syncLedgersFromTally() {
  return fetchJson("/api/sync-ledgers", {
    method: "POST",
  });
}

export async function reviseBankStatement(statement, userInstructions) {
  return fetchJson("/api/bank-statements/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement, userInstructions }),
  });
}

export async function learnBankStatement(statement, userInstructions = "") {
  return fetchJson("/api/bank-statements/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement, userInstructions }),
  });
}

export async function correctTransaction(transactionId, payload) {
  return fetchJson(`/api/transactions/${transactionId}/correct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function reviseInvoice(invoice, userInstructions) {
  return fetchJson("/api/invoices/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice, userInstructions }),
  });
}

export async function reviseRecommendations(payload, userInstructions, context = {}) {
  return fetchJson("/api/recommendations/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, userInstructions, context }),
  });
}

// Bank statement persistence and undo/redo endpoints
export async function saveBankStatementAnalysis(statement, analysisId = null) {
  return fetchJson("/api/bank-statements/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: analysisId, statement }),
  });
}

export async function getBankStatementAnalysis(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}`);
}

export async function listBankStatementAnalyses(clientId = null, limit = 50) {
  const params = new URLSearchParams();
  if (clientId) params.append("clientId", clientId);
  params.append("limit", limit);
  return fetchJson(`/api/bank-statements/analyses?${params.toString()}`);
}

export async function deleteBankStatementAnalysis(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}`, {
    method: "DELETE",
  });
}

export async function getStatementChangeHistory(analysisId, limit = 100) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/history?limit=${limit}`);
}

export async function recordStatementChange(analysisId, changeType, previousState, newState, changeSummary) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/record-change`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      changeType,
      previousState,
      newState,
      changeSummary,
    }),
  });
}

export async function undoStatementChange(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

// Duplicate Detection
export async function detectDuplicates(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/detect-duplicates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function getDuplicates(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/duplicates`);
}

// Pre-Export Validation
export async function validateForExport(analysisId, ledgerHeads = []) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/validate-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ledgerHeads }),
  });
}

export async function getValidations(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/validations`);
}

export async function getMappingRules(clientId) {
  return fetchJson(`/api/bank-statements/mapping-rules?clientId=${clientId}`);
}

// Account Mappings
export async function saveAccountMapping(clientIdOrPayload, debitAccount, creditAccount, frequency = 1, confidenceScore = 0.8) {
  const payload =
    typeof clientIdOrPayload === "object" && clientIdOrPayload !== null
      ? {
          clientId: clientIdOrPayload.clientId,
          debitAccount: clientIdOrPayload.debitAccount,
          creditAccount: clientIdOrPayload.creditAccount,
          frequency: clientIdOrPayload.frequency ?? 1,
          confidenceScore:
            clientIdOrPayload.confidenceScore ??
            clientIdOrPayload.confidence ??
            0.8,
        }
      : {
          clientId: clientIdOrPayload,
          debitAccount,
          creditAccount,
          frequency,
          confidenceScore,
        };

  return fetchJson(`/api/bank-statements/account-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAccountMappings(clientId) {
  return fetchJson(`/api/bank-statements/account-mappings?clientId=${clientId}`);
}

export async function deleteAccountMapping(mappingId) {
  return fetchJson(`/api/bank-statements/account-mappings/${mappingId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

// Analytics
export async function recordMetric(clientId, analysisId, metricType, metricValue, metricLabel = "") {
  return fetchJson(`/api/bank-statements/analytics/record-metric`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, analysisId, metricType, metricValue, metricLabel }),
  });
}

export async function getStatementMetrics(statement, clientId, analysisId) {
  return fetchJson(`/api/bank-statements/analytics/statement-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement, clientId, analysisId }),
  });
}

export async function getAnalytics(clientId, days = 30) {
  return fetchJson(`/api/bank-statements/analytics?clientId=${clientId}&days=${days}`);
}

// Reconciliation
export async function startReconciliation(analysisId, clientId, expectedCount = 0, xmlHash = "") {
  return fetchJson(`/api/bank-statements/reconciliation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisId, clientId, expectedCount, xmlHash }),
  });
}

export async function verifyReconciliation(analysisId, receivedCount, matchedEntries = 0, mismatches = []) {
  return fetchJson(`/api/bank-statements/reconciliation/${analysisId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receivedCount, matchedEntries, mismatches }),
  });
}

export async function getReconciliation(analysisId) {
  return fetchJson(`/api/bank-statements/reconciliation/${analysisId}`);
}

// User Assignments
export async function assignUserToAnalysis(analysisId, userId, assignedBy = null) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/assign-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, assignedBy }),
  });
}

export async function getAnalysisAssignees(analysisId) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/assignees`);
}

// Audit Logging
export async function recordAuditLog(analysisId, userId, action, changes = {}, ipAddress = "") {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/audit-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, action, changes, ipAddress }),
  });
}

export async function getAuditLogs(analysisId, limit = 100) {
  return fetchJson(`/api/bank-statements/analyses/${analysisId}/audit-logs?limit=${limit}`);
}

// ML Classification
export async function classifySingleTransaction(transaction) {
  return fetchJson("/api/ml-classify/single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
  });
}

export async function classifyBatchTransactions(transactions) {
  return fetchJson("/api/ml-classify/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions }),
  });
}

export async function recordMLFeedback(transactionId, originalClassification, userCorrection) {
  return fetchJson("/api/ml-classify/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId, originalClassification, userCorrection }),
  });
}

export async function detectAnomalies(transaction) {
  return fetchJson("/api/ml-classify/anomaly-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
  });
}

export async function getMLMetrics() {
  return fetchJson("/api/ml-classify/metrics");
}

export async function validateMLBatch(classifications = []) {
  return fetchJson("/api/ml-classify/validate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classifications }),
  });
}

// Compliance APIs
export async function generateComplianceScorecard(companyId, fiscalYear) {
  return postJson("/api/compliance/scorecard", { companyId, fiscalYear });
}

export async function getTDSSummary(companyId, fiscalYear) {
  return fetchJson(`/api/compliance/tds-summary/${companyId}/${fiscalYear}`);
}

export async function getTDSDetails(companyId, fiscalYear) {
  return fetchJson(`/api/compliance/tds-details/${companyId}/${fiscalYear}`);
}

export async function addTDSEntry(companyId, entry) {
  return postJson("/api/compliance/tds-entry", { companyId, entry });
}

export async function getGSTSummary(companyId, fiscalYear) {
  return fetchJson(`/api/compliance/gst-summary/${companyId}/${fiscalYear}`);
}

export async function getComplianceChecklist(companyId, fiscalYear) {
  return fetchJson(`/api/compliance/checklist/${companyId}/${fiscalYear}`);
}

export async function updateChecklistTask(taskId, updates) {
  return fetchJson(`/api/compliance/checklist/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function getUpcomingDueDates(companyId, month) {
  return fetchJson(`/api/compliance/due-dates/${companyId}/${month}`);
}

export async function getComplianceAlerts(companyId) {
  return fetchJson(`/api/compliance/alerts/${companyId}`);
}

export async function performGSTReconciliation(companyId, fiscalYear) {
  return postJson("/api/compliance/gst-reconciliation", { companyId, fiscalYear });
}

export async function generateTDSCertificate(companyId, payeeId, fiscalYear) {
  return postJson("/api/compliance/tds-certificate", { companyId, payeeId, fiscalYear });
}

export async function getComplianceAuditTrail(companyId, fiscalYear) {
  return fetchJson(`/api/compliance/audit-trail/${companyId}/${fiscalYear}`);
}

export async function reconcileGstr2bFull(gstr2bFile, ledgerFiles) {
  const form = new FormData();
  form.append("gstr2b", gstr2bFile);
  ledgerFiles.forEach((f) => form.append("ledgers", f));
  return postForm("/api/reconcile/gstr2b", form);
}

export function downloadGstr2bReport(downloadUrl) {
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = "GSTR2B_Reconciliation.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadGstr2bFile(downloadUrl, filename) {
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename || "download.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


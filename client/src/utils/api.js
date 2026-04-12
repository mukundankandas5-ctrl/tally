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
  formData.append("gstr2b", gstr2bFile);
  formData.append("purchaseRegister", purchaseRegisterFile);
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

export async function downloadGstWorkbook(payload) {
  const response = await postJson("/api/gst/export", payload);
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

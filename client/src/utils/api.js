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

export async function fetchTallyStatus() {
  return fetchJson("/api/tally/status");
}

export async function uploadInvoice(file) {
  const formData = new FormData();
  formData.append("file", file);
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

export async function uploadBankStatement(file) {
  const formData = new FormData();
  formData.append("file", file);
  return postForm("/api/bank-statements/analyze", formData);
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

export async function analyzeRecommendations(file) {
  const formData = new FormData();
  formData.append("file", file);
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
  return postForm("/api/gst/reconcile", formData);
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

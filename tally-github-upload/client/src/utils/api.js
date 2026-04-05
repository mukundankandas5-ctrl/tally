const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function readError(response) {
  try {
    const payload = await response.json();
    return payload.message || "Request failed.";
  } catch (error) {
    return "Request failed.";
  }
}

export async function fetchLedgers() {
  const response = await fetch(`${API_BASE_URL}/api/reference/ledgers`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function uploadInvoice(file, userInstructions = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (userInstructions) {
    formData.append("userInstructions", userInstructions);
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/extract`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function exportInvoice(payload) {
  const response = await fetch(`${API_BASE_URL}/api/invoices/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.blob();
}

export async function reviseInvoice(payload, userInstructions) {
  const response = await fetch(`${API_BASE_URL}/api/invoices/revise`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice: payload,
      userInstructions,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function uploadBankStatement(file, userInstructions = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (userInstructions) {
    formData.append("userInstructions", userInstructions);
  }

  const response = await fetch(`${API_BASE_URL}/api/bank-statements/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function exportBankStatement(payload) {
  const response = await fetch(`${API_BASE_URL}/api/bank-statements/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.blob();
}

export async function reviseBankStatement(payload, userInstructions) {
  const response = await fetch(`${API_BASE_URL}/api/bank-statements/revise`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statement: payload,
      userInstructions,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function learnBankStatement(payload, userInstructions) {
  const response = await fetch(`${API_BASE_URL}/api/bank-statements/learn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statement: payload,
      userInstructions,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

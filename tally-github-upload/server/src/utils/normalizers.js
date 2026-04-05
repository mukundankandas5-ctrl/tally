const confidenceValues = new Set(["high", "medium", "low"]);

function cleanString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const normalized = String(value)
    .replace(/[₹,\s]/g, "")
    .replace(/\((.*)\)/, "-$1")
    .replace(/cr$/i, "")
    .replace(/dr$/i, "")
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeConfidence(value) {
  const normalized = cleanString(value, "medium").toLowerCase();
  return confidenceValues.has(normalized) ? normalized : "medium";
}

function formatIsoDateParts(year, month, day) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function toIsoDate(value) {
  const raw = cleanString(value);
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{8}$/.test(raw)) {
    return formatIsoDateParts(raw.slice(0, 4), raw.slice(4, 6), raw.slice(6, 8));
  }

  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const [, first, second, yearToken] = slashMatch;
    const year = yearToken.length === 2 ? `20${yearToken}` : yearToken;
    return formatIsoDateParts(year, second, first);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatIsoDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return "";
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toFixedAmount(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function makeIdentifier(prefix, index) {
  return `${prefix}-${index + 1}`;
}

function inferVoucherType(transaction) {
  if (cleanString(transaction.voucherType)) {
    return cleanString(transaction.voucherType);
  }

  const narration = cleanString(transaction.narration).toLowerCase();
  const ledgerHead = cleanString(transaction.ledgerHead).toLowerCase();
  const isContra =
    narration.includes("cash withdrawal") ||
    narration.includes("cash deposit") ||
    narration.includes("self transfer") ||
    narration.includes("own account") ||
    ledgerHead.includes("cash") ||
    ledgerHead.includes("transfer");

  if (isContra) {
    return "Contra";
  }

  return toNumber(transaction.credit, 0) > 0 ? "Receipt" : "Payment";
}

module.exports = {
  cleanString,
  ensureArray,
  inferVoucherType,
  makeIdentifier,
  normalizeConfidence,
  toFixedAmount,
  toIsoDate,
  toNumber,
};

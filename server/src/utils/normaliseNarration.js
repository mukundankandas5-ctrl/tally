const UPI_MERCHANT_MAP = {
  SWIGGY: "Meals & Entertainment",
  ZOMATO: "Meals & Entertainment",
  AMAZON: "Office Supplies / E-commerce",
  FLIPKART: "Office Supplies / E-commerce",
  IRCTC: "Travel & Conveyance",
  MAKEMYTRIP: "Travel & Conveyance",
  CLEARTRIP: "Travel & Conveyance",
  AIRTEL: "Telephone & Internet",
  JIO: "Telephone & Internet",
  BSNL: "Telephone & Internet",
  VODAFONE: "Telephone & Internet",
  BESCOM: "Electricity & Utilities",
  MSEDCL: "Electricity & Utilities",
  TNEB: "Electricity & Utilities",
  BSES: "Electricity & Utilities",
  KSEB: "Electricity & Utilities",
  LIC: "Insurance Premium",
  SBILIFE: "Insurance Premium",
  HDFCLIFE: "Insurance Premium",
  ICICIPRU: "Insurance Premium",
  NSDL: "FD / Investment",
  CDSL: "FD / Investment",
  GSTN: "GST Payment",
  EPFO: "PF Contribution",
};

const PAYMENT_MODE_PATTERNS = {
  NEFT: /NEFT/i,
  IMPS: /IMPS/i,
  RTGS: /RTGS/i,
  UPI: /UPI/i,
  ACH: /\bACH\b/i,
  ECS: /\bECS\b/i,
  NACH: /NACH/i,
  CHEQUE: /CLG|CHQ|CHEQUE/i,
};

function normaliseNarration(raw, amount, txnType) {
  const numericAmount = Number(amount || 0);
  let text = String(raw || "").toUpperCase().trim();

  const upiMatch =
    text.match(/(?:UPI|VPA|UPI\/ID)[\/:\-\s]*([A-Z0-9._-]+@[A-Z0-9._-]+)/i) ||
    text.match(/\b([A-Z0-9._-]+@[A-Z0-9._-]+)\b/i);
  const upiVpa = upiMatch ? upiMatch[1] : null;

  let detectedMerchant = null;
  if (upiVpa) {
    for (const [key, category] of Object.entries(UPI_MERCHANT_MAP)) {
      if (upiVpa.toUpperCase().includes(key)) {
        detectedMerchant = { name: key, suggestedCategory: category };
        break;
      }
    }
  }

  let detectedMode = "UNKNOWN";
  for (const [mode, pattern] of Object.entries(PAYMENT_MODE_PATTERNS)) {
    if (pattern.test(text)) {
      detectedMode = mode;
      break;
    }
  }

  const cleaned = text
    .replace(/\b\d{10,}\b/g, " ")
    .replace(/\b\d{2}[\/\-]\d{2}[\/\-]\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isRoundAmount = numericAmount >= 5000 && numericAmount % 500 === 0;

  return {
    original: raw || "",
    cleaned,
    upiVpa,
    detectedMerchant,
    detectedMode,
    isRoundAmount,
    amount: Number.isFinite(numericAmount) ? numericAmount : 0,
    txnType: txnType === "CREDIT" ? "CREDIT" : "DEBIT",
  };
}

module.exports = { normaliseNarration, UPI_MERCHANT_MAP };

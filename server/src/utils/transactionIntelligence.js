const { cleanString } = require("./normalizers");

const CATEGORY_DEFAULTS = {
  "Sales / Revenue": { ledger: "Sales", voucherType: "Receipt" },
  "Service Income": { ledger: "Miscellaneous Income", voucherType: "Receipt" },
  "Interest Received": { ledger: "Interest Income", voucherType: "Receipt" },
  "Rental Income": { ledger: "Rent", voucherType: "Receipt" },
  "Commission Received": { ledger: "Commission Paid", voucherType: "Receipt" },
  "Refund Received": { ledger: "Miscellaneous Income", voucherType: "Receipt" },
  "Loan Disbursement Received": { ledger: "Loan Account", voucherType: "Receipt" },
  "Salary & Wages": { ledger: "Salary", voucherType: "Payment" },
  "Rent Paid": { ledger: "Rent", voucherType: "Payment" },
  "Electricity & Utilities": { ledger: "Electricity", voucherType: "Payment" },
  "Office Supplies": { ledger: "Office Expenses", voucherType: "Payment" },
  "Travel & Conveyance": { ledger: "Travelling Expenses", voucherType: "Payment" },
  "Meals & Entertainment": { ledger: "Office Expenses", voucherType: "Payment" },
  "Professional Fees": { ledger: "Professional Fees", voucherType: "Payment" },
  "Software & Subscriptions": { ledger: "Software Subscription", voucherType: "Payment" },
  "Advertising & Marketing": { ledger: "Marketing Expenses", voucherType: "Payment" },
  "Repairs & Maintenance": { ledger: "Repairs & Maintenance", voucherType: "Payment" },
  "Insurance Premium": { ledger: "Insurance", voucherType: "Payment" },
  "Telephone & Internet": { ledger: "Internet Charges", voucherType: "Payment" },
  "Printing & Stationery": { ledger: "Printing & Stationery", voucherType: "Payment" },
  "Miscellaneous Expense": { ledger: "Miscellaneous Expenses", voucherType: "Payment" },
  "GST Payment": { ledger: "GST Payment", voucherType: "Payment" },
  "TDS Deducted": { ledger: "TDS Payment", voucherType: "Journal" },
  "TDS Received": { ledger: "Income Tax", voucherType: "Journal" },
  "Advance Tax": { ledger: "Advance Tax", voucherType: "Payment" },
  "Professional Tax": { ledger: "Income Tax", voucherType: "Payment" },
  "PF Contribution": { ledger: "PF Contribution", voucherType: "Payment" },
  "ESI Contribution": { ledger: "ESI Contribution", voucherType: "Payment" },
  "Bank Charges & Fees": { ledger: "Bank Charges", voucherType: "Payment" },
  "Loan EMI Repayment": { ledger: "Loan Account", voucherType: "Payment" },
  "Interest on Loan": { ledger: "Interest on Loan", voucherType: "Payment" },
  "FD / Investment": { ledger: "Loan Account", voucherType: "Contra" },
  "FD Maturity / Investment Return": { ledger: "Interest Income", voucherType: "Receipt" },
  "Inter-bank Transfer": { ledger: "Transfer to Own Account", voucherType: "Contra" },
  "Vendor Payment": { ledger: "Sundry Creditor", voucherType: "Payment" },
  "Customer Receipt": { ledger: "Sundry Debtor", voucherType: "Receipt" },
  "Director / Partner Drawing": { ledger: "Drawings", voucherType: "Contra" },
  "Capital Contribution": { ledger: "Capital Account", voucherType: "Receipt" },
  "Petty Cash": { ledger: "Petty Cash", voucherType: "Contra" },
};

const HEURISTIC_RULES = [
  {
    id: "gst-payment",
    category: "GST Payment",
    ledger: "GST Payment",
    voucherType: "Payment",
    minScore: 0.88,
    flags: [],
    test: (n) => /GSTN|GST PMT|GST PAYMENT|CPIN|TAX PAID CHALLAN/.test(n.cleaned),
  },
  {
    id: "tds",
    category: "TDS Deducted",
    ledger: "TDS Payment",
    voucherType: "Journal",
    minScore: 0.86,
    flags: [],
    test: (n) => /TDS|194[A-Z]?|INCOME TAX/.test(n.cleaned) && n.txnType === "DEBIT",
  },
  {
    id: "salary",
    category: "Salary & Wages",
    ledger: "Salary",
    voucherType: "Payment",
    minScore: 0.9,
    flags: [],
    test: (n) => /SALARY|PAYROLL|WAGES|STAFF PAY|EMP PAY/.test(n.cleaned) && n.txnType === "DEBIT",
  },
  {
    id: "emi",
    category: "Loan EMI Repayment",
    ledger: "Loan Account",
    voucherType: "Payment",
    minScore: 0.88,
    flags: [],
    test: (n) => /EMI|HOME LOAN|HOUSING LOAN|CAR LOAN|PERSONAL LOAN|HL EMI|CL EMI/.test(n.cleaned) && n.txnType === "DEBIT",
  },
  {
    id: "insurance",
    category: "Insurance Premium",
    ledger: "Insurance",
    voucherType: "Payment",
    minScore: 0.86,
    flags: [],
    test: (n) => /LIC|SBI LIFE|HDFC LIFE|ICICI PRU|BAJAJ ALLIANZ|MAX LIFE|TATA AIA|POL NO/.test(n.cleaned) && n.txnType === "DEBIT",
  },
  {
    id: "bank-charges",
    category: "Bank Charges & Fees",
    ledger: "Bank Charges",
    voucherType: "Payment",
    minScore: 0.9,
    flags: [],
    test: (n) => /CHARGES|CHARGE|SMS ALERT|ATM FEE|ANNUAL FEE|PROCESSING FEE|DEMAT AMC|SERVICE FEE/.test(n.cleaned),
  },
  {
    id: "fd-booking",
    category: "FD / Investment",
    ledger: "Loan Account",
    voucherType: "Contra",
    minScore: 0.86,
    flags: [],
    test: (n) => /FD BOOKING|FIXED DEPOSIT|TERM DEPOSIT|FD BKG|MUTUAL FUND|SIP|NSDL|CDSL|ZERODHA|GROWW/.test(n.cleaned),
  },
  {
    id: "fd-maturity",
    category: "FD Maturity / Investment Return",
    ledger: "Interest Income",
    voucherType: "Receipt",
    minScore: 0.88,
    flags: [],
    test: (n) => /FD MATURITY|TERM DEPOSIT MATURITY|INT CR|INTEREST CREDIT|DIVIDEND/.test(n.cleaned) && n.txnType === "CREDIT",
  },
  {
    id: "own-transfer",
    category: "Inter-bank Transfer",
    ledger: "Transfer to Own Account",
    voucherType: "Contra",
    minScore: 0.92,
    flags: [],
    test: (n) => /SELF|OWN ACCOUNT|TRANSFER TO SELF|TRF TO .* SELF/.test(n.cleaned),
  },
  {
    id: "cash",
    category: "Petty Cash",
    ledger: "Cash",
    voucherType: "Contra",
    minScore: 0.84,
    flags: [],
    test: (n) => /ATM WDL|CASH WITHDRAWAL|CASH DEP|CDM|ATM/.test(n.cleaned),
  },
];

function uniq(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizedTokens(normalised) {
  return uniq(normalised?.tokens || []);
}

function tokenOverlapScore(left = [], right = []) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const matches = left.filter((token) => rightSet.has(token)).length;
  return matches / Math.max(left.length, right.length);
}

function deriveDefaultLedger(category, txnType, normalised) {
  if (normalised?.detectedMerchant?.suggestedCategory === category && CATEGORY_DEFAULTS[category]?.ledger) {
    return CATEGORY_DEFAULTS[category].ledger;
  }
  return CATEGORY_DEFAULTS[category]?.ledger || (txnType === "CREDIT" ? "Sundry Debtor" : "Miscellaneous Expenses");
}

function deriveDefaultVoucherType(category, txnType) {
  return CATEGORY_DEFAULTS[category]?.voucherType || (txnType === "CREDIT" ? "Receipt" : "Payment");
}

function buildHeuristicCandidates(normalised) {
  const candidates = [];

  for (const rule of HEURISTIC_RULES) {
    if (!rule.test(normalised)) continue;
    candidates.push({
      source: "heuristic",
      category: rule.category,
      ledger: rule.ledger || deriveDefaultLedger(rule.category, normalised.txnType, normalised),
      voucher_type: rule.voucherType || deriveDefaultVoucherType(rule.category, normalised.txnType),
      confidence: rule.minScore,
      reasoning: `Matched local accounting rule "${rule.id}" from narration patterns.`,
      flags: rule.flags || [],
    });
  }

  if (normalised?.detectedMerchant?.suggestedCategory) {
    const category = normalised.detectedMerchant.suggestedCategory;
    candidates.push({
      source: "merchant-map",
      category,
      ledger: deriveDefaultLedger(category, normalised.txnType, normalised),
      voucher_type: deriveDefaultVoucherType(category, normalised.txnType),
      confidence: 0.82,
      reasoning: `Mapped merchant ${normalised.detectedMerchant.name} from narration/VPA to ${category}.`,
      flags: [],
    });
  }

  if (normalised?.counterpartyName && normalised.txnType === "DEBIT" && !candidates.length) {
    candidates.push({
      source: "counterparty",
      category: "Vendor Payment",
      ledger: normalised.counterpartyName,
      voucher_type: "Payment",
      confidence: 0.7,
      reasoning: `Detected named debit counterparty ${normalised.counterpartyName}.`,
      flags: ["needs_counterparty_info"],
    });
  }

  if (normalised?.counterpartyName && normalised.txnType === "CREDIT" && !candidates.length) {
    candidates.push({
      source: "counterparty",
      category: "Customer Receipt",
      ledger: normalised.counterpartyName,
      voucher_type: "Receipt",
      confidence: 0.72,
      reasoning: `Detected named credit counterparty ${normalised.counterpartyName}.`,
      flags: ["needs_counterparty_info"],
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function buildRuleCandidates(normalised, userRules = []) {
  const tokens = normalizedTokens(normalised);
  const candidates = [];

  for (const rule of userRules) {
    const pattern = cleanString(rule.pattern).toUpperCase();
    if (!pattern) continue;

    const ruleTokens = pattern
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3);
    const overlap = tokenOverlapScore(tokens, ruleTokens);
    const includesPattern = normalised.cleaned.includes(pattern);
    const vpaMatch = rule.upi_vpa && normalised.upiVpa && String(normalised.upiVpa).toUpperCase() === String(rule.upi_vpa).toUpperCase();
    const score = Math.max(
      includesPattern ? 0.92 : 0,
      vpaMatch ? 0.95 : 0,
      overlap >= 0.75 ? 0.9 : overlap >= 0.5 ? 0.82 : overlap >= 0.34 ? 0.72 : 0
    );

    if (score < 0.7) continue;

    candidates.push({
      source: "learned-rule",
      category: cleanString(rule.category) || "Miscellaneous Expense",
      ledger: cleanString(rule.ledger) || deriveDefaultLedger(rule.category, normalised.txnType, normalised),
      voucher_type: cleanString(rule.voucher_type) || deriveDefaultVoucherType(rule.category, normalised.txnType),
      confidence: Math.min(0.98, Math.max(score, Number(rule.confidence_score || 0.8))),
      reasoning: includesPattern
        ? `Matched learned narration rule "${pattern}".`
        : vpaMatch
          ? `Matched learned UPI VPA rule for ${rule.upi_vpa}.`
          : `Matched learned transaction pattern with ${Math.round(overlap * 100)}% token overlap.`,
      flags: [],
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function buildLocalRecommendation(normalised, userRules = []) {
  const candidates = [...buildRuleCandidates(normalised, userRules), ...buildHeuristicCandidates(normalised)];
  const best = candidates[0] || null;

  return {
    best,
    candidates: candidates.slice(0, 5),
  };
}

function validateClassificationShape(classification, normalised) {
  if (!classification) return null;

  const category = cleanString(classification.category) || "Miscellaneous Expense";
  const voucher_type = cleanString(classification.voucher_type) || deriveDefaultVoucherType(category, normalised.txnType);
  const ledger = cleanString(classification.ledger) || deriveDefaultLedger(category, normalised.txnType, normalised);

  let adjustedVoucher = voucher_type;
  if (normalised.txnType === "CREDIT" && adjustedVoucher === "Payment") {
    adjustedVoucher = deriveDefaultVoucherType(category, normalised.txnType);
  }
  if (normalised.txnType === "DEBIT" && adjustedVoucher === "Receipt" && !/Capital Contribution|FD Maturity/.test(category)) {
    adjustedVoucher = deriveDefaultVoucherType(category, normalised.txnType);
  }

  return {
    ...classification,
    category,
    ledger,
    voucher_type: adjustedVoucher,
    confidence: Math.max(0, Math.min(1, Number(classification.confidence || 0))),
    flags: uniq(Array.isArray(classification.flags) ? classification.flags.map(String) : []),
  };
}

function blendClassifications(localBest, aiResult, normalised) {
  const local = validateClassificationShape(localBest, normalised);
  const ai = validateClassificationShape(aiResult, normalised);
  if (!local && !ai) return null;
  if (!ai) return local;
  if (!local) return ai;

  const sameCategory = local.category === ai.category;
  const sameVoucher = local.voucher_type === ai.voucher_type;
  const sameLedger = cleanString(local.ledger).toLowerCase() === cleanString(ai.ledger).toLowerCase();

  if (sameCategory && sameVoucher) {
    return {
      ...ai,
      ledger: sameLedger ? ai.ledger : local.ledger || ai.ledger,
      confidence: Math.min(0.99, Math.max(ai.confidence, local.confidence) + 0.04),
      reasoning: `${ai.reasoning} Local pattern engine agreed with the same accounting outcome.`,
      flags: uniq([...(ai.flags || []), ...(local.flags || [])]),
    };
  }

  if (local.confidence >= 0.92 && ai.confidence < 0.8) {
    return {
      ...local,
      confidence: Math.min(0.98, local.confidence),
      reasoning: `${local.reasoning} Local rule overrode a lower-confidence AI suggestion.`,
      flags: uniq([...(local.flags || []), "local_override"]),
    };
  }

  if (ai.confidence >= local.confidence + 0.08) {
    return ai;
  }

  return {
    ...ai,
    voucher_type: sameVoucher ? ai.voucher_type : local.voucher_type,
    confidence: Math.max(0.6, Math.min(ai.confidence, local.confidence)),
    reasoning: `${ai.reasoning} Local signals disagreed, so this row is downgraded for review.`,
    flags: uniq([...(ai.flags || []), ...(local.flags || []), "local_ai_disagreement"]),
  };
}

module.exports = {
  buildLocalRecommendation,
  blendClassifications,
  deriveDefaultLedger,
  deriveDefaultVoucherType,
  validateClassificationShape,
};

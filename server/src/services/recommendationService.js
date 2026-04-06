const XLSX = require("xlsx");
const env = require("../config/env");
const AppError = require("../utils/appError");
const { ledgerHeads, defaultVoucherLedgers } = require("../constants/ledgerHeads");
const { requestStructuredJson } = require("./anthropicService");
const { getLearnedRuleForNarration, getLearningSummary } = require("./learningService");
const { cleanString, toFixedAmount, toIsoDate, toNumber } = require("../utils/normalizers");

const descriptionKeys = ["description", "narration", "particulars", "remarks", "details", "transaction description"];
const dateKeys = ["date", "txn date", "transaction date", "voucher date"];
const debitKeys = ["debit", "withdrawal", "dr amount", "payment"];
const creditKeys = ["credit", "deposit", "cr amount", "receipt"];
const balanceKeys = ["balance", "closing balance"];
const ledgerKeys = ["ledger", "ledger head", "suggested ledger", "category"];

function readWorkbookRows(file) {
  if (!file?.buffer) {
    throw new AppError("Please upload an Excel file first.", 400);
  }

  try {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  } catch (error) {
    throw new AppError("The uploaded spreadsheet could not be read.", 400, {
      cause: error.message,
    });
  }
}

function getValue(row, keys) {
  const key = Object.keys(row).find((candidate) => keys.includes(String(candidate).trim().toLowerCase()));
  return key ? row[key] : "";
}

function heuristicMapping(description, debit, credit) {
  const value = cleanString(description).toLowerCase();
  const isCredit = toNumber(credit, 0) > 0;

  if (value.includes("salary")) return { ledgerHead: "Salary", voucherType: isCredit ? "Receipt" : "Payment", confidence: "high" };
  if (value.includes("rent")) return { ledgerHead: "Rent", voucherType: "Payment", confidence: "high" };
  if (value.includes("gst")) return { ledgerHead: "GST Payment", voucherType: "Payment", confidence: "high" };
  if (value.includes("emi")) return { ledgerHead: "EMI", voucherType: "Payment", confidence: "high" };
  if (value.includes("cash withdrawal")) return { ledgerHead: "Cash Withdrawal", voucherType: "Contra", confidence: "high" };
  if (value.includes("cash dep")) return { ledgerHead: "Cash Deposit", voucherType: "Contra", confidence: "medium" };
  if (value.includes("upi")) return { ledgerHead: "UPI Transfer", voucherType: isCredit ? "Receipt" : "Payment", confidence: "medium" };
  if (value.includes("vendor") || value.includes("traders")) return { ledgerHead: "Sundry Creditor", voucherType: "Payment", confidence: "medium" };
  if (value.includes("customer") || value.includes("invoice")) return { ledgerHead: "Sundry Debtor", voucherType: "Receipt", confidence: "medium" };

  return {
    ledgerHead: isCredit ? "Customer Receipt" : "Office Expenses",
    voucherType: isCredit ? "Receipt" : "Payment",
    confidence: "low",
  };
}

async function requestAiSuggestions(rows) {
  if (!env.anthropicApiKey || rows.length === 0 || rows.length > 120) {
    return [];
  }

  try {
    const structured = await requestStructuredJson({
      systemPrompt: [
        "You are an expert Indian accounting assistant generating ledger suggestions for bulk transaction mapping.",
        "Return JSON only with this exact shape:",
        "{",
        '  "suggestions": [',
        '    {"id":"","ledgerHead":"","voucherType":"Payment|Receipt|Contra","confidence":"high|medium|low","rationale":""}',
        "  ]",
        "}",
        `Choose ledgerHead only from this list: ${ledgerHeads.map((item) => item.name).join(", ")}`,
        "Be conservative when the narration is ambiguous.",
      ].join("\n"),
      contentBlocks: [
        {
          type: "text",
          text: `Rows to classify:\n${JSON.stringify(rows, null, 2)}`,
        },
      ],
      maxTokens: 4096,
    });

    return Array.isArray(structured?.suggestions) ? structured.suggestions : [];
  } catch (error) {
    return [];
  }
}

async function analyzeRecommendations(file, context = {}) {
  const rows = readWorkbookRows(file);
  const normalizedRows = rows
    .map((row, index) => {
      const description = cleanString(getValue(row, descriptionKeys));
      if (!description) {
        return null;
      }

      return {
        id: `rec-${index + 1}`,
        date: toIsoDate(getValue(row, dateKeys)),
        description,
        debit: toFixedAmount(getValue(row, debitKeys)),
        credit: toFixedAmount(getValue(row, creditKeys)),
        balance: toFixedAmount(getValue(row, balanceKeys)),
        currentLedger: cleanString(getValue(row, ledgerKeys)),
      };
    })
    .filter(Boolean);

  const aiSuggestions = await requestAiSuggestions(
    normalizedRows.map((row) => ({
      id: row.id,
      description: row.description,
      debit: row.debit,
      credit: row.credit,
      currentLedger: row.currentLedger,
    }))
  );

  const aiById = new Map(aiSuggestions.map((suggestion) => [suggestion.id, suggestion]));
  const mappings = normalizedRows.map((row) => {
    const learned = getLearnedRuleForNarration(row.description, context);
    const heuristic = heuristicMapping(row.description, row.debit, row.credit);
    const ai = aiById.get(row.id);

    const suggestion = {
      ledgerHead:
        cleanString(row.currentLedger) ||
        cleanString(learned?.ledgerHead) ||
        cleanString(ai?.ledgerHead) ||
        heuristic.ledgerHead,
      voucherType: cleanString(learned?.voucherType) || cleanString(ai?.voucherType) || heuristic.voucherType,
      confidence: cleanString(ai?.confidence) || heuristic.confidence,
      rationale:
        cleanString(ai?.rationale) ||
        (learned ? `Matched learned mapping from "${cleanString(learned.sampleNarration)}".` : "Suggested from narration keywords."),
      source: learned ? "learned" : ai ? "anthropic" : "heuristic",
    };

    return {
      ...row,
      suggestion,
      accepted: suggestion.confidence !== "low",
    };
  });

  return {
    confidence: mappings.some((item) => item.suggestion.confidence === "low") ? "medium" : "high",
    summary: {
      totalRows: mappings.length,
      acceptedCount: mappings.filter((item) => item.accepted).length,
      needsReviewCount: mappings.filter((item) => item.suggestion.confidence === "low").length,
    },
    mappings,
    learningSummary: getLearningSummary(context),
    tallyConfig: {
      companyName: cleanString(context.companyName),
      clientId: cleanString(context.clientId),
      bankName: cleanString(context.bankName),
      bankLedgerName: defaultVoucherLedgers.bankLedgerName,
    },
  };
}

function buildRecommendationStatement(payload = {}) {
  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];

  return {
    tallyConfig: {
      companyName: cleanString(payload.tallyConfig?.companyName),
      bankLedgerName: cleanString(payload.tallyConfig?.bankLedgerName || defaultVoucherLedgers.bankLedgerName),
    },
    transactions: mappings
      .filter((item) => item.accepted)
      .map((item) => ({
        id: item.id,
        date: item.date,
        narration: item.description,
        reference: item.id,
        debit: toFixedAmount(item.debit),
        credit: toFixedAmount(item.credit),
        balance: toFixedAmount(item.balance),
        ledgerHead: cleanString(item.suggestion?.ledgerHead),
        confidence: cleanString(item.suggestion?.confidence || "medium"),
        needsReview: cleanString(item.suggestion?.confidence) === "low",
        voucherType: cleanString(item.suggestion?.voucherType),
        debitAccount:
          cleanString(item.suggestion?.voucherType) === "Receipt"
            ? cleanString(payload.tallyConfig?.bankLedgerName || defaultVoucherLedgers.bankLedgerName)
            : cleanString(item.suggestion?.ledgerHead),
        creditAccount:
          cleanString(item.suggestion?.voucherType) === "Receipt"
            ? cleanString(item.suggestion?.ledgerHead)
            : cleanString(payload.tallyConfig?.bankLedgerName || defaultVoucherLedgers.bankLedgerName),
      })),
  };
}

async function reviseRecommendations(payload = {}, userInstructions = "", context = {}) {
  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
  if (mappings.length === 0) return payload;

  const safeInstructions = cleanString(userInstructions).slice(0, 4000);
  if (!safeInstructions) return payload;

  const ledgerOptions = ledgerHeads.map((item) => item.name).join(", ");
  const result = await requestStructuredJson({
    systemPrompt: [
      "You are an expert Indian accounting assistant revising bulk transaction mappings and suggestions.",
      "You will receive the current mappings (narration, current ledger, and voucher type) plus user instructions.",
      "Return JSON only with this exact shape:",
      "{",
      '  "suggestions": [',
      '    {"id":"","ledgerHead":"","voucherType":"Payment|Receipt|Contra","confidence":"high|medium|low","rationale":""}',
      "  ]",
      "}",
      `Choose ledgerHead only from this list: ${ledgerOptions}`,
      "Apply changes only where the user's instructions require it.",
    ].join("\n"),
    contentBlocks: [
      {
        type: "text",
        text: `Current mappings:\n${JSON.stringify(
          mappings.map((m) => ({
            id: m.id,
            description: m.description,
            ledgerHead: m.suggestion?.ledgerHead,
            voucherType: m.suggestion?.voucherType,
          })),
          null,
          2
        )}`,
      },
      {
        type: "text",
        text: `User instructions:\n${safeInstructions}`,
      },
    ],
    maxTokens: 4096,
  });

  const aiSuggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const aiById = new Map(aiSuggestions.map((s) => [s.id, s]));

  const nextMappings = mappings.map((row) => {
    const ai = aiById.get(row.id);
    if (!ai) return row;

    const suggestion = {
      ...row.suggestion,
      ledgerHead: cleanString(ai.ledgerHead) || row.suggestion.ledgerHead,
      voucherType: cleanString(ai.voucherType) || row.suggestion.voucherType,
      confidence: cleanString(ai.confidence) || row.suggestion.confidence,
      rationale: cleanString(ai.rationale) || row.suggestion.rationale,
      source: "anthropic",
    };

    return {
      ...row,
      suggestion,
      accepted: suggestion.confidence !== "low",
    };
  });

  return {
    ...payload,
    mappings: nextMappings,
    summary: {
      totalRows: nextMappings.length,
      acceptedCount: nextMappings.filter((m) => m.accepted).length,
      needsReviewCount: nextMappings.filter((m) => m.suggestion.confidence === "low").length,
    },
  };
}

module.exports = {
  analyzeRecommendations,
  buildRecommendationStatement,
  reviseRecommendations,
};


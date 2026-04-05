const pdfParse = require("pdf-parse");
const { requestStructuredJson } = require("./anthropicService");
const { applyLearnedMappings, getLearningSummary } = require("./learningService");
const { ledgerHeads, defaultVoucherLedgers } = require("../constants/ledgerHeads");
const AppError = require("../utils/appError");
const {
  cleanString,
  ensureArray,
  inferVoucherType,
  makeIdentifier,
  normalizeConfidence,
  toFixedAmount,
  toIsoDate,
  toNumber,
} = require("../utils/normalizers");

function sanitizeUserInstructions(value) {
  return cleanString(value).slice(0, 4000);
}

async function extractTextOnlyPdf(buffer) {
  const result = await pdfParse(buffer);
  return cleanString(result.text);
}

function inferAccounts(transaction, fallbackBankLedger = defaultVoucherLedgers.bankLedgerName) {
  const bankLedgerName = cleanString(transaction.bankLedgerName || fallbackBankLedger) || defaultVoucherLedgers.bankLedgerName;
  const voucherType = cleanString(transaction.voucherType) || inferVoucherType(transaction);
  const explicitDebitAccount = cleanString(transaction.debitAccount);
  const explicitCreditAccount = cleanString(transaction.creditAccount);
  const ledgerHead = cleanString(transaction.ledgerHead) || "Suspense A/c";
  const debit = toFixedAmount(transaction.debit);
  const credit = toFixedAmount(transaction.credit);

  if (explicitDebitAccount && explicitCreditAccount) {
    return {
      debitAccount: explicitDebitAccount,
      creditAccount: explicitCreditAccount,
    };
  }

  if (voucherType === "Receipt" || credit > 0) {
    return {
      debitAccount: explicitDebitAccount || bankLedgerName,
      creditAccount: explicitCreditAccount || ledgerHead,
    };
  }

  if (voucherType === "Contra" && debit === 0 && credit === 0) {
    return {
      debitAccount: explicitDebitAccount || bankLedgerName,
      creditAccount: explicitCreditAccount || ledgerHead,
    };
  }

  return {
    debitAccount: explicitDebitAccount || ledgerHead,
    creditAccount: explicitCreditAccount || bankLedgerName,
  };
}

function normalizeTransactions(payload, bankLedgerName = defaultVoucherLedgers.bankLedgerName) {
  return ensureArray(payload.transactions).map((transaction, index) => {
    const debit = toFixedAmount(transaction.debit);
    const credit = toFixedAmount(transaction.credit);
    const amount = debit > 0 ? debit : credit;
    const confidence = normalizeConfidence(transaction.confidence);
    const voucherType = cleanString(transaction.voucherType) || inferVoucherType(transaction);
    const accounts = inferAccounts(
      {
        ...transaction,
        voucherType,
      },
      bankLedgerName
    );
    const needsReview =
      Boolean(transaction.needsReview) ||
      confidence === "low" ||
      !cleanString(transaction.ledgerHead);

    return {
      id: cleanString(transaction.id, makeIdentifier("txn", index)),
      date: toIsoDate(transaction.date),
      narration: cleanString(transaction.narration),
      reference: cleanString(transaction.reference),
      debit,
      credit,
      balance: toFixedAmount(transaction.balance),
      amount,
      ledgerHead: cleanString(transaction.ledgerHead),
      confidence,
      needsReview,
      voucherType,
      debitAccount: cleanString(accounts.debitAccount),
      creditAccount: cleanString(accounts.creditAccount),
      learningSource: cleanString(transaction.learningSource),
    };
  });
}

function buildSummary(payload, transactions) {
  const totalDebits = toFixedAmount(
    payload.summary?.totalDebits ||
      transactions.reduce((sum, transaction) => sum + toNumber(transaction.debit, 0), 0)
  );
  const totalCredits = toFixedAmount(
    payload.summary?.totalCredits ||
      transactions.reduce((sum, transaction) => sum + toNumber(transaction.credit, 0), 0)
  );

  return {
    periodStart: toIsoDate(payload.summary?.periodStart),
    periodEnd: toIsoDate(payload.summary?.periodEnd),
    totalDebits,
    totalCredits,
    transactionCount: transactions.length,
    reviewCount: transactions.filter((transaction) => transaction.needsReview).length,
  };
}

async function analyzeBankStatement(file, userInstructions = "") {
  if (!file) {
    throw new AppError("Please upload a bank statement PDF.", 400);
  }

  let extractedText = "";
  try {
    extractedText = await extractTextOnlyPdf(file.buffer);
  } catch (error) {
    throw new AppError("The uploaded PDF could not be read. Please try another file.", 400, {
      cause: error.message,
    });
  }

  if (!extractedText || extractedText.replace(/\s/g, "").length < 80) {
    throw new AppError(
      "This bank statement appears to be a scanned image PDF. Please upload a text-based PDF or run OCR before trying again.",
      422
    );
  }

  const ledgerOptions = ledgerHeads.map((ledger) => ledger.name).join(", ");
  const safeInstructions = sanitizeUserInstructions(userInstructions);
  const learningSummary = getLearningSummary();

  const structured = await requestStructuredJson({
    systemPrompt: [
      "You are an expert Indian bank statement parser and Tally ledger classifier.",
      "Parse every transaction row from the supplied bank statement text.",
      "Return valid JSON with this exact shape:",
      "{",
      '  "confidence": "high|medium|low",',
      '  "summary": {',
      '    "periodStart": "YYYY-MM-DD or empty string",',
      '    "periodEnd": "YYYY-MM-DD or empty string",',
      '    "totalDebits": 0,',
      '    "totalCredits": 0',
      "  },",
      '  "transactions": [',
      "    {",
      '      "id": "",',
      '      "date": "YYYY-MM-DD",',
      '      "narration": "",',
      '      "reference": "",',
      '      "debit": 0,',
      '      "credit": 0,',
      '      "balance": 0,',
      `      "ledgerHead": "choose one of: ${ledgerOptions}",`,
      '      "confidence": "high|medium|low",',
      '      "needsReview": false,',
      '      "voucherType": "Payment|Receipt|Contra",',
      '      "debitAccount": "",',
      '      "creditAccount": ""',
      "    }",
      "  ],",
      '  "reviewNotes": [""]',
      "}",
      "Do not skip rows.",
      "Use conservative low confidence when the narration is ambiguous.",
      "For UPI transactions, identify the beneficiary or counterparty name from the narration whenever possible.",
      "If the UPI counterparty appears to be an individual person and there is no strong business indicator, classify it as UPI Transfer.",
      "If the UPI counterparty appears to be a business or organization, infer the most appropriate ledger based on the business name and transaction context, not merely UPI Transfer.",
      "For IMPS and NEFT transactions, inspect the narration carefully for the sender or receiver name.",
      "If a clear person or business name is present in IMPS or NEFT narration, use that actual counterparty name as the ledger head instead of a generic transfer label.",
      "Only fall back to generic labels when no reliable counterparty name can be identified from the narration.",
      "Treat internal transfers, FD bookings, sweep transfers, cash deposits, and cash withdrawals as Contra where appropriate.",
      "Always return debitAccount and creditAccount to show which account is debited and which account is credited.",
      "If the user provides custom classification instructions, follow them unless they clearly conflict with the transaction text.",
      "Return JSON only.",
    ].join("\n"),
    contentBlocks: [
      {
        type: "text",
        text: `Bank statement text:\n${extractedText}`,
      },
      ...(safeInstructions
        ? [
            {
              type: "text",
              text: `Additional user instructions:\n${safeInstructions}`,
            },
          ]
        : []),
      ...(learningSummary.learnedRuleCount
        ? [
            {
              type: "text",
              text: `Previously learned user preferences:\n${JSON.stringify(learningSummary, null, 2)}`,
            },
          ]
        : []),
    ],
  });

  const transactions = applyLearnedMappings(
    normalizeTransactions(structured, defaultVoucherLedgers.bankLedgerName)
  );

  return {
    confidence: normalizeConfidence(structured.confidence),
    summary: buildSummary(structured, transactions),
    transactions,
    reviewNotes: ensureArray(structured.reviewNotes)
      .map((note) => cleanString(note))
      .filter(Boolean),
    tallyConfig: {
      companyName: "",
      bankLedgerName: defaultVoucherLedgers.bankLedgerName,
    },
    learningSummary,
  };
}

async function reviseBankStatement(statement, userInstructions = "") {
  const safeInstructions = sanitizeUserInstructions(userInstructions);

  if (!safeInstructions) {
    throw new AppError("Add instructions for the AI assistant before revising the bank statement output.", 400);
  }

  const bankLedgerName = cleanString(statement?.tallyConfig?.bankLedgerName || defaultVoucherLedgers.bankLedgerName);
  const normalizedTransactions = normalizeTransactions(statement || {}, bankLedgerName);
  const normalizedStatement = {
    confidence: normalizeConfidence(statement?.confidence),
    summary: buildSummary(statement || {}, normalizedTransactions),
    transactions: normalizedTransactions,
    reviewNotes: ensureArray(statement?.reviewNotes)
      .map((note) => cleanString(note))
      .filter(Boolean),
    tallyConfig: {
      companyName: cleanString(statement?.tallyConfig?.companyName),
      bankLedgerName,
    },
  };

  const ledgerOptions = ledgerHeads.map((ledger) => ledger.name).join(", ");
  const structured = await requestStructuredJson({
    systemPrompt: [
      "You are an expert Indian accounting assistant revising already classified bank statement transactions.",
      "You will receive the current structured bank statement JSON plus user instructions.",
      "Return valid JSON with this exact shape:",
      "{",
      '  "confidence": "high|medium|low",',
      '  "summary": {',
      '    "periodStart": "YYYY-MM-DD or empty string",',
      '    "periodEnd": "YYYY-MM-DD or empty string",',
      '    "totalDebits": 0,',
      '    "totalCredits": 0',
      "  },",
      '  "transactions": [',
      "    {",
      '      "id": "",',
      '      "date": "YYYY-MM-DD",',
      '      "narration": "",',
      '      "reference": "",',
      '      "debit": 0,',
      '      "credit": 0,',
      '      "balance": 0,',
      `      "ledgerHead": "choose one of: ${ledgerOptions}",`,
      '      "confidence": "high|medium|low",',
      '      "needsReview": false,',
      '      "voucherType": "Payment|Receipt|Contra",',
      '      "debitAccount": "",',
      '      "creditAccount": ""',
      "    }",
      "  ],",
      '  "reviewNotes": [""]',
      "}",
      "Adjust only what the user's instructions require and preserve all other rows.",
      "For UPI transactions, distinguish people from organizations whenever possible.",
      "Use UPI Transfer for individuals without a clear business purpose and use a more specific business ledger when the counterparty appears to be an organization.",
      "For IMPS and NEFT transactions, prefer the actual sender or receiver name as the ledger head whenever the narration clearly includes that name.",
      "Always return debitAccount and creditAccount for each row.",
      "Return JSON only.",
    ].join("\n"),
    contentBlocks: [
      {
        type: "text",
        text: `Current bank statement JSON:\n${JSON.stringify(normalizedStatement, null, 2)}`,
      },
      {
        type: "text",
        text: `User instructions:\n${safeInstructions}`,
      },
    ],
    maxTokens: 8192,
  });

  const revisedTransactions = applyLearnedMappings(normalizeTransactions(structured, bankLedgerName));

  return {
    confidence: normalizeConfidence(structured.confidence),
    summary: buildSummary(structured, revisedTransactions),
    transactions: revisedTransactions,
    reviewNotes: ensureArray(structured.reviewNotes)
      .map((note) => cleanString(note))
      .filter(Boolean),
    tallyConfig: {
      ...normalizedStatement.tallyConfig,
      ...(structured.tallyConfig || {}),
    },
    learningSummary: getLearningSummary(),
  };
}

module.exports = {
  analyzeBankStatement,
  reviseBankStatement,
};

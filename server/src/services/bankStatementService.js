const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const { requestStructuredJson } = require("./anthropicService");
const { applyLearnedMappings, getLearningSummary } = require("./learningService");
const {
  saveTransactions,
  getClientMappingRules,
} = require("../db/database");
const AppError = require("../utils/appError");
const { classifyBatch } = require("../utils/classifyTransaction");
const {
  cleanString,
  ensureArray,
  inferVoucherType,
  toFixedAmount,
  toIsoDate,
  toNumber,
} = require("../utils/normalizers");
const { defaultVoucherLedgers } = require("../constants/ledgerHeads");

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

  return {
    debitAccount: explicitDebitAccount || ledgerHead,
    creditAccount: explicitCreditAccount || bankLedgerName,
  };
}

function scoreToConfidenceLabel(score) {
  const numeric = Number(score || 0);
  if (numeric >= 0.85) return "high";
  if (numeric >= 0.6) return "medium";
  return "low";
}

function statusToNeedsReview(status) {
  return status === "suggested" || status === "flagged";
}

function statementConfidenceFromTransactions(transactions) {
  if (!transactions.length) return "low";
  const average = transactions.reduce((sum, txn) => sum + Number(txn.confidence || 0), 0) / transactions.length;
  return scoreToConfidenceLabel(average);
}

function buildSummary(transactions) {
  const sortedDates = transactions.map((transaction) => transaction.date).filter(Boolean).sort();
  return {
    periodStart: sortedDates[0] || "",
    periodEnd: sortedDates[sortedDates.length - 1] || "",
    totalDebits: toFixedAmount(transactions.reduce((sum, transaction) => sum + toNumber(transaction.debit, 0), 0)),
    totalCredits: toFixedAmount(transactions.reduce((sum, transaction) => sum + toNumber(transaction.credit, 0), 0)),
    transactionCount: transactions.length,
    reviewCount: transactions.filter((transaction) => transaction.needsReview).length,
  };
}

async function parseStatementRows(extractedText, userInstructions = "") {
  const structured = await requestStructuredJson({
    systemPrompt: [
      "You are an expert parser for Indian bank statements.",
      "Extract all transaction rows from the text exactly as they appear.",
      "Do not classify into ledgers. Only extract structured transaction rows.",
      "Return valid JSON with this exact shape:",
      "{",
      '  "summary": {',
      '    "periodStart": "YYYY-MM-DD or empty string",',
      '    "periodEnd": "YYYY-MM-DD or empty string"',
      "  },",
      '  "transactions": [',
      "    {",
      '      "date": "YYYY-MM-DD",',
      '      "narration": "",',
      '      "reference": "",',
      '      "debit": 0,',
      '      "credit": 0,',
      '      "balance": 0',
      "    }",
      "  ]",
      "}",
      "Rules:",
      "- Use debit and credit as positive numbers.",
      "- If only one amount exists and row is debit/outflow set debit.",
      "- If only one amount exists and row is credit/inflow set credit.",
      "- Do not skip rows.",
      "- Return JSON only.",
    ].join("\n"),
    contentBlocks: [
      {
        type: "text",
        text: `Bank statement text:\n${extractedText}`,
      },
      ...(userInstructions
        ? [
            {
              type: "text",
              text: `User extraction guidance:\n${userInstructions}`,
            },
          ]
        : []),
    ],
    maxTokens: 8192,
  });

  return structured;
}

function normalizeParsedRows(parsed = {}) {
  return ensureArray(parsed.transactions)
    .map((transaction) => {
      const debit = toFixedAmount(transaction.debit);
      const credit = toFixedAmount(transaction.credit);
      const amount = debit > 0 ? debit : credit;
      const narration = cleanString(transaction.narration);

      return {
        date: toIsoDate(transaction.date),
        narration,
        reference: cleanString(transaction.reference),
        debit,
        credit,
        balance: toFixedAmount(transaction.balance),
        amount,
        txnType: credit > 0 ? "CREDIT" : "DEBIT",
      };
    })
    .filter((row) => row.narration && Number(row.amount) > 0);
}

function toStatementTransaction(parsedRow, classification, bankLedgerName, clientId) {
  const status = classification.status || "flagged";
  const confidence = Number(classification.confidence || 0);
  const voucherType = cleanString(classification.voucher_type) || (parsedRow.txnType === "CREDIT" ? "Receipt" : "Payment");
  const ledgerHead = cleanString(classification.ledger) || cleanString(classification.category) || "Miscellaneous";
  const accounts = inferAccounts(
    {
      ...parsedRow,
      voucherType,
      ledgerHead,
      debit: parsedRow.debit,
      credit: parsedRow.credit,
    },
    bankLedgerName
  );

  return {
    id: crypto.randomUUID(),
    clientId: cleanString(clientId),
    date: parsedRow.date,
    narration: parsedRow.narration,
    reference: parsedRow.reference,
    debit: parsedRow.debit,
    credit: parsedRow.credit,
    balance: parsedRow.balance,
    amount: parsedRow.amount,
    txnType: parsedRow.txnType,
    category: cleanString(classification.category) || "Miscellaneous Expense",
    ledgerHead,
    ledger: ledgerHead,
    voucherType,
    debitAccount: cleanString(accounts.debitAccount),
    creditAccount: cleanString(accounts.creditAccount),
    confidence,
    confidenceLabel: scoreToConfidenceLabel(confidence),
    reasoning: cleanString(classification.reasoning),
    flags: ensureArray(classification.flags),
    status,
    needsReview: statusToNeedsReview(status),
    normalised: classification.normalised || null,
    upiVpa: cleanString(classification.normalised?.upiVpa),
  };
}

function persistTransactions(transactions, clientId) {
  saveTransactions(
    transactions.map((transaction) => ({
      id: transaction.id,
      client_id: cleanString(clientId),
      narration: transaction.narration,
      normalised_narration: cleanString(transaction.normalised?.cleaned),
      upi_vpa: transaction.upiVpa || null,
      amount: transaction.amount,
      debit: transaction.debit,
      credit: transaction.credit,
      txn_type: transaction.txnType,
      date: transaction.date,
      category: transaction.category,
      ledger: transaction.ledgerHead,
      voucher_type: transaction.voucherType,
      confidence: transaction.confidence,
      confidence_label: transaction.confidenceLabel,
      reasoning: transaction.reasoning,
      flags: JSON.stringify(transaction.flags || []),
      status: transaction.status,
      created_at: new Date().toISOString(),
    }))
  );
}

async function analyzeBankStatement(file, userInstructions = "", context = {}) {
  if (!file) {
    throw new AppError("Please upload a bank statement PDF.", 400);
  }

  const safeInstructions = sanitizeUserInstructions(userInstructions);

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

  const parsed = await parseStatementRows(extractedText, safeInstructions);
  const parsedRows = normalizeParsedRows(parsed);

  if (!parsedRows.length) {
    throw new AppError("Could not detect transactions from this PDF. Please upload a clearer text-based bank statement.", 422);
  }

  const bankLedgerName = cleanString(context.bankLedgerName || defaultVoucherLedgers.bankLedgerName);
  const clientId = cleanString(context.clientId);
  const classifications = await classifyBatch(
    parsedRows,
    clientId,
    { getClientMappingRules },
    safeInstructions
  );

  let transactions = parsedRows.map((row, index) =>
    toStatementTransaction(row, classifications[index] || {}, bankLedgerName, clientId)
  );

  transactions = applyLearnedMappings(transactions, context).map((transaction) => {
    if (!cleanString(transaction.learningSource)) return transaction;
    return {
      ...transaction,
      status: transaction.status === "auto_mapped" ? transaction.status : "confirmed",
      needsReview: false,
    };
  });

  persistTransactions(transactions, clientId);

  const summary = buildSummary(transactions);
  const confidence = statementConfidenceFromTransactions(transactions);

  return {
    originalFileName: file.originalname || "",
    confidence,
    summary: {
      ...summary,
      periodStart: toIsoDate(parsed.summary?.periodStart) || summary.periodStart,
      periodEnd: toIsoDate(parsed.summary?.periodEnd) || summary.periodEnd,
    },
    transactions,
    reviewNotes: [],
    tallyConfig: {
      companyName: cleanString(context.companyName),
      clientId,
      bankName: cleanString(context.bankName),
      bankLedgerName,
    },
    learningSummary: getLearningSummary(context),
  };
}

async function reviseBankStatement(statement, userInstructions = "", context = {}) {
  const safeInstructions = sanitizeUserInstructions(userInstructions);
  if (!safeInstructions) {
    throw new AppError("Add instructions for the AI assistant before revising the bank statement output.", 400);
  }

  const currentTransactions = ensureArray(statement?.transactions).map((transaction) => {
    const debit = toFixedAmount(transaction.debit);
    const credit = toFixedAmount(transaction.credit);
    return {
      date: toIsoDate(transaction.date),
      narration: cleanString(transaction.narration),
      reference: cleanString(transaction.reference),
      debit,
      credit,
      balance: toFixedAmount(transaction.balance),
      amount: debit > 0 ? debit : credit,
      txnType: credit > 0 ? "CREDIT" : "DEBIT",
    };
  });

  if (!currentTransactions.length) {
    throw new AppError("No transactions available to revise.", 400);
  }

  const bankLedgerName = cleanString(statement?.tallyConfig?.bankLedgerName || defaultVoucherLedgers.bankLedgerName);
  const clientId = cleanString(context.clientId || statement?.tallyConfig?.clientId);
  const classifications = await classifyBatch(
    currentTransactions,
    clientId,
    { getClientMappingRules },
    safeInstructions
  );

  const revisedTransactions = currentTransactions.map((row, index) =>
    toStatementTransaction(row, classifications[index] || {}, bankLedgerName, clientId)
  );
  const summary = buildSummary(revisedTransactions);

  return {
    ...statement,
    confidence: statementConfidenceFromTransactions(revisedTransactions),
    summary,
    transactions: revisedTransactions,
    reviewNotes: [],
    learningSummary: getLearningSummary({
      clientId,
      bankName: cleanString(context.bankName || statement?.tallyConfig?.bankName),
    }),
  };
}

module.exports = {
  analyzeBankStatement,
  reviseBankStatement,
};

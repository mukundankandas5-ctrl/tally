const fs = require("fs");
const path = require("path");
const { cleanString } = require("../utils/normalizers");

const dataDirectory = path.resolve(__dirname, "../data");
const memoryFile = path.join(dataDirectory, "learned-mappings.json");

const ignoredTokens = new Set([
  "upi",
  "dr",
  "cr",
  "imps",
  "neft",
  "rtgs",
  "ach",
  "atm",
  "bank",
  "txn",
  "transfer",
  "trf",
  "self",
  "ref",
  "kotak",
  "mahindra",
  "india",
  "ltd",
  "pvt",
  "private",
  "limited",
]);

function ensureMemoryFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, JSON.stringify({ rules: {}, instructionHistory: [] }, null, 2), "utf8");
  }
}

function loadMemory() {
  ensureMemoryFile();

  try {
    return JSON.parse(fs.readFileSync(memoryFile, "utf8"));
  } catch (error) {
    return { rules: {}, instructionHistory: [] };
  }
}

function saveMemory(memory) {
  ensureMemoryFile();
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2), "utf8");
}

function tokenizeNarration(narration) {
  return cleanString(narration)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !ignoredTokens.has(token) && !/^\d+$/.test(token));
}

function buildNarrationSignature(narration) {
  return tokenizeNarration(narration).slice(0, 6).join("|");
}

function getLearningSummary() {
  const memory = loadMemory();
  return {
    learnedRuleCount: Object.keys(memory.rules || {}).length,
    recentInstructions: (memory.instructionHistory || []).slice(0, 3),
  };
}

function applyLearnedMappings(transactions) {
  const memory = loadMemory();

  return (Array.isArray(transactions) ? transactions : []).map((transaction) => {
    const signature = buildNarrationSignature(transaction.narration);
    const learnedRule = signature ? memory.rules?.[signature] : null;

    if (!learnedRule) {
      return transaction;
    }

    return {
      ...transaction,
      ledgerHead: cleanString(transaction.ledgerHead) || cleanString(learnedRule.ledgerHead),
      voucherType: cleanString(transaction.voucherType) || cleanString(learnedRule.voucherType),
      debitAccount: cleanString(transaction.debitAccount) || cleanString(learnedRule.debitAccount),
      creditAccount: cleanString(transaction.creditAccount) || cleanString(learnedRule.creditAccount),
      learningSource: cleanString(learnedRule.sampleNarration),
    };
  });
}

function learnFromStatement(statement, userInstructions = "") {
  const memory = loadMemory();
  const transactions = Array.isArray(statement?.transactions) ? statement.transactions : [];

  transactions.forEach((transaction) => {
    const signature = buildNarrationSignature(transaction.narration);
    if (!signature) {
      return;
    }

    if (!cleanString(transaction.ledgerHead) || !cleanString(transaction.debitAccount) || !cleanString(transaction.creditAccount)) {
      return;
    }

    const existing = memory.rules?.[signature] || {
      signature,
      observations: 0,
      sampleNarration: cleanString(transaction.narration),
    };

    memory.rules[signature] = {
      ...existing,
      sampleNarration: cleanString(transaction.narration),
      ledgerHead: cleanString(transaction.ledgerHead),
      voucherType: cleanString(transaction.voucherType),
      debitAccount: cleanString(transaction.debitAccount),
      creditAccount: cleanString(transaction.creditAccount),
      observations: Number(existing.observations || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  });

  if (cleanString(userInstructions)) {
    memory.instructionHistory = [
      {
        instruction: cleanString(userInstructions).slice(0, 4000),
        recordedAt: new Date().toISOString(),
      },
      ...(memory.instructionHistory || []),
    ].slice(0, 25);
  }

  saveMemory(memory);

  return {
    learnedRuleCount: Object.keys(memory.rules || {}).length,
    instructionHistoryCount: (memory.instructionHistory || []).length,
  };
}

module.exports = {
  applyLearnedMappings,
  buildNarrationSignature,
  getLearningSummary,
  learnFromStatement,
};

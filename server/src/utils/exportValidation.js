/**
 * Pre-export validation utility
 * Checks for various data quality issues before exporting to Tally
 */

function validateTransaction(transaction, ledgerHeads = []) {
  const issues = [];
  const validLedgers = ledgerHeads.map((l) => l.name) || [];

  // Check for required fields
  if (!transaction.ledger || transaction.ledger.trim() === "") {
    issues.push({
      type: "missing_ledger",
      severity: "error",
      message: `Transaction ${transaction.id}: Missing ledger assignment`,
    });
  } else if (validLedgers.length > 0 && !validLedgers.includes(transaction.ledger)) {
    issues.push({
      type: "invalid_ledger",
      severity: "warning",
      message: `Transaction ${transaction.id}: Ledger "${transaction.ledger}" not found in Tally`,
    });
  }

  // Check debit/credit accounts
  if (!transaction.debitAccount || transaction.debitAccount.trim() === "") {
    if (transaction.voucherType === "Payment") {
      issues.push({
        type: "missing_debit_account",
        severity: "error",
        message: `Transaction ${transaction.id}: Missing debit account for Payment voucher`,
      });
    }
  }

  if (!transaction.creditAccount || transaction.creditAccount.trim() === "") {
    if (transaction.voucherType === "Receipt") {
      issues.push({
        type: "missing_credit_account",
        severity: "error",
        message: `Transaction ${transaction.id}: Missing credit account for Receipt voucher`,
      });
    }
  }

  // Check amounts
  const debit = Number(transaction.debit || 0);
  const credit = Number(transaction.credit || 0);

  if (debit < 0 || credit < 0) {
    issues.push({
      type: "negative_amount",
      severity: "error",
      message: `Transaction ${transaction.id}: Negative amounts are not allowed`,
    });
  }

  if (debit === 0 && credit === 0) {
    issues.push({
      type: "zero_amount",
      severity: "error",
      message: `Transaction ${transaction.id}: Transaction amount cannot be zero`,
    });
  }

  // Check for zero-balance transactions (both debit and credit filled)
  if (debit > 0 && credit > 0) {
    issues.push({
      type: "both_debit_credit",
      severity: "warning",
      message: `Transaction ${transaction.id}: Both debit and credit amounts are filled`,
    });
  }

  // Check narration
  if (!transaction.narration || transaction.narration.trim() === "") {
    issues.push({
      type: "missing_narration",
      severity: "warning",
      message: `Transaction ${transaction.id}: Missing transaction description/narration`,
    });
  }

  // Check confidence level
  if ((transaction.confidence || 0) < 0.5) {
    issues.push({
      type: "low_confidence",
      severity: "warning",
      message: `Transaction ${transaction.id}: Low AI confidence (${Math.round((transaction.confidence || 0) * 100)}%) - review recommended`,
    });
  }

  // Check needs review flag
  if (transaction.needsReview) {
    issues.push({
      type: "flagged_for_review",
      severity: "info",
      message: `Transaction ${transaction.id}: Marked for review`,
    });
  }

  return issues;
}

function validateBankStatement(statement, ledgerHeads = []) {
  /**
   * Validates entire bank statement before export
   * Returns validation result with error/warning counts and details
   */

  const allIssues = [];
  const transactions = statement.transactions || [];

  // Validate each transaction
  for (const transaction of transactions) {
    const issues = validateTransaction(transaction, ledgerHeads);
    allIssues.push(...issues);
  }

  // Check statement-level validations
  if (transactions.length === 0) {
    allIssues.push({
      type: "no_transactions",
      severity: "error",
      message: "No transactions in statement",
    });
  }

  // Check for unbalanced debits/credits
  const totalDebits = transactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    allIssues.push({
      type: "unbalanced_statement",
      severity: "warning",
      message: `Statement is unbalanced: ₹${totalDebits.toFixed(2)} debits vs ₹${totalCredits.toFixed(2)} credits`,
    });
  }

  // Check configuration
  if (!statement.tallyConfig?.companyName || statement.tallyConfig.companyName.trim() === "") {
    allIssues.push({
      type: "missing_company",
      severity: "error",
      message: "Tally company name not specified",
    });
  }

  if (!statement.tallyConfig?.bankLedgerName || statement.tallyConfig.bankLedgerName.trim() === "") {
    allIssues.push({
      type: "missing_bank_ledger",
      severity: "error",
      message: "Bank ledger name not specified",
    });
  }

  // Categorize issues
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  return {
    isValid: errorCount === 0,
    canProceed: errorCount === 0, // Can export if no errors
    issues: allIssues,
    summary: {
      totalIssues: allIssues.length,
      errors: errorCount,
      warnings: warningCount,
      infos: infoCount,
    },
    transactions: {
      total: transactions.length,
      reviewed: transactions.filter((t) => !t.needsReview).length,
      flagged: transactions.filter((t) => t.needsReview).length,
      highConfidence: transactions.filter((t) => (t.confidence || 0) >= 0.8).length,
    },
  };
}

function getValidationSummary(validationResult) {
  /**
   * Returns human-readable validation summary for UI display
   */

  const { summary, isValid, issues } = validationResult;

  const errorIssues = issues.filter((i) => i.severity === "error").slice(0, 5);
  const warningIssues = issues.filter((i) => i.severity === "warning").slice(0, 3);

  return {
    status: isValid ? "valid" : "invalid",
    message: isValid ? "✅ Ready for export" : "⚠️ Issues found",
    summary,
    topErrors: errorIssues,
    topWarnings: warningIssues,
    canExport: isValid,
  };
}

module.exports = {
  validateTransaction,
  validateBankStatement,
  getValidationSummary,
};

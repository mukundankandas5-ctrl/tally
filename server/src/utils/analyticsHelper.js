/**
 * Analytics utility for tracking processing metrics
 */

function calculateStatementMetrics(statement) {
  /**
   * Calculates various metrics from a bank statement
   */
  const transactions = statement.transactions || [];

  const totalTransactions = transactions.length;
  const totalDebits = transactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);

  const confidenceScores = transactions.map((t) => Number(t.confidence || 0));
  const avgConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;
  const minConfidence = confidenceScores.length > 0 ? Math.min(...confidenceScores) : 0;
  const maxConfidence = confidenceScores.length > 0 ? Math.max(...confidenceScores) : 0;

  const highConfidenceCount = transactions.filter((t) => (t.confidence || 0) >= 0.8).length;
  const mediumConfidenceCount = transactions.filter((t) => (t.confidence || 0) >= 0.5 && (t.confidence || 0) < 0.8).length;
  const lowConfidenceCount = transactions.filter((t) => (t.confidence || 0) < 0.5).length;

  const needsReviewCount = transactions.filter((t) => t.needsReview).length;
  const reviewedCount = totalTransactions - needsReviewCount;

  const learnedRuleCount = transactions.filter((t) => t.learningSource).length;
  const manualCount = totalTransactions - learnedRuleCount;

  const voucherPaymentCount = transactions.filter((t) => t.voucherType === "Payment").length;
  const voucherReceiptCount = transactions.filter((t) => t.voucherType === "Receipt").length;
  const voucherContraCount = transactions.filter((t) => t.voucherType === "Contra").length;

  const flaggedTransactions = transactions.filter((t) => t.flags && t.flags.length > 0).length;

  return {
    totals: {
      transactions: totalTransactions,
      debits: totalDebits,
      credits: totalCredits,
      balance: totalDebits - totalCredits,
    },
    confidence: {
      average: avgConfidence,
      min: minConfidence,
      max: maxConfidence,
      high: highConfidenceCount,
      medium: mediumConfidenceCount,
      low: lowConfidenceCount,
    },
    status: {
      needsReview: needsReviewCount,
      reviewed: reviewedCount,
    },
    learning: {
      fromLearnedRules: learnedRuleCount,
      manual: manualCount,
    },
    vouchers: {
      payments: voucherPaymentCount,
      receipts: voucherReceiptCount,
      contra: voucherContraCount,
    },
    quality: {
      flagged: flaggedTransactions,
      reviewRequired: needsReviewCount === 0 ? "No" : "Yes",
    },
  };
}

function formatMetricsForDisplay(metrics) {
  /**
   * Formats metrics in human-readable form for dashboard
   */
  return {
    "Total Transactions": metrics.totals.transactions,
    "Total Debits": `₹${metrics.totals.debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    "Total Credits": `₹${metrics.totals.credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    "Avg Confidence": `${(metrics.confidence.average * 100).toFixed(1)}%`,
    "Reviewed": `${metrics.status.reviewed}/${metrics.totals.transactions}`,
    "From Learned Rules": `${metrics.learning.fromLearnedRules} (${Math.round((metrics.learning.fromLearnedRules / metrics.totals.transactions) * 100)}%)`,
    "Payment Vouchers": metrics.vouchers.payments,
    "Receipt Vouchers": metrics.vouchers.receipts,
    "Contra Vouchers": metrics.vouchers.contra,
  };
}

module.exports = {
  calculateStatementMetrics,
  formatMetricsForDisplay,
};

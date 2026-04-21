const { tdsConfigs, getFinancialYear } = require("../constants/tdsConfig");

/**
 * Calculate TDS applicable on a payment
 * @param {Object} payment - {amount, section, deducteeType, panAvailable, date}
 * @returns {Object} - {applicableTds, section, rate, reason, details}
 */
function calculateTds(payment) {
  const { amount, section = "194J", deducteeType = "Individuals", panAvailable = false, date = new Date() } = payment;

  if (!section || !tdsConfigs[section]) {
    return {
      applicableTds: 0,
      section: "NONE",
      rate: 0,
      reason: "Invalid TDS section specified",
      details: null,
    };
  }

  const config = tdsConfigs[section];

  // Check if threshold is exceeded
  if (amount < config.thresholdLimit) {
    return {
      applicableTds: 0,
      section,
      rate: config.tdsRate,
      reason: `Amount below threshold limit of ₹${config.thresholdLimit.toLocaleString("en-IN")}`,
      details: { thresholdLimit: config.thresholdLimit, amountProvided: amount },
    };
  }

  // Check if applicable to deductee type
  if (config.applicableTo !== "All" && !config.applicableTo.includes(deducteeType)) {
    return {
      applicableTds: 0,
      section,
      rate: config.tdsRate,
      reason: `TDS not applicable for ${deducteeType}`,
      details: { applicableTo: config.applicableTo, deducteeType },
    };
  }

  // Calculate TDS
  const tdsAmount = (amount * config.tdsRate) / 100;

  return {
    applicableTds: Math.round(tdsAmount),
    section,
    rate: config.tdsRate,
    reason: `TDS applicable under Section ${section}`,
    details: {
      netAmount: amount - Math.round(tdsAmount),
      grossAmount: amount,
      tdsPercentage: config.tdsRate,
      panRequired: panAvailable || amount >= 200000, // PAN mandatory above 2 lakh
    },
  };
}

/**
 * Determine appropriate TDS section based on transaction type
 */
function suggestTdsSection(transactionType, amount) {
  const suggestions = [];

  for (const [section, config] of Object.entries(tdsConfigs)) {
    if (config.applicableFor.some((type) => type.toLowerCase().includes(transactionType.toLowerCase()))) {
      suggestions.push({
        section,
        name: config.name,
        rate: config.tdsRate,
        applicable: amount >= config.thresholdLimit,
      });
    }
  }

  return suggestions;
}

/**
 * Generate TDS certificate data (Form 16 / Form 16A)
 */
function generateTdsCertificate(tdsPayments, fyYear, certificateType = "16A") {
  const fy = fyYear || new Date().getFullYear();
  const certData = {
    certificateType, // 16 for salary, 16A for others
    certificateNumber: `${certificateType}/${fy}/${Date.now()}`,
    financialYear: `${fy}-${fy + 1}`,
    assessmentYear: fy + 1,
    dateGenerated: new Date().toISOString(),
    summaryBySection: {},
    totalTdsDeducted: 0,
    allPayments: tdsPayments,
  };

  // Aggregate by section
  tdsPayments.forEach((payment) => {
    const section = payment.section || "194J";
    if (!certData.summaryBySection[section]) {
      certData.summaryBySection[section] = {
        totalPayment: 0,
        totalTds: 0,
        count: 0,
      };
    }
    certData.summaryBySection[section].totalPayment += payment.amount;
    certData.summaryBySection[section].totalTds += payment.tdsDeducted;
    certData.summaryBySection[section].count += 1;
    certData.totalTdsDeducted += payment.tdsDeducted;
  });

  return certData;
}

/**
 * Reconcile Form 26AS (TDS credit) with ledger
 */
function reconcileForm26As(form26AsData, ledgerTdsPayments) {
  const reconciliation = {
    form26AsTotal: 0,
    ledgerTotal: 0,
    matchedPayments: [],
    unmatchedForm26As: [],
    unmatchedLedger: [],
    variance: 0,
    status: "MATCHED",
  };

  // Aggregate Form 26AS
  form26AsData.forEach((item) => {
    reconciliation.form26AsTotal += item.tdsAmount || 0;
  });

  // Aggregate ledger
  ledgerTdsPayments.forEach((item) => {
    reconciliation.ledgerTotal += item.tdsDeducted || 0;
  });

  // Calculate variance
  reconciliation.variance = Math.abs(reconciliation.form26AsTotal - reconciliation.ledgerTotal);

  // Status determination
  if (reconciliation.variance === 0) {
    reconciliation.status = "PERFECT_MATCH";
  } else if (reconciliation.variance <= 100) {
    reconciliation.status = "MINOR_VARIANCE"; // Rounding/timing differences
  } else {
    reconciliation.status = "MAJOR_VARIANCE";
  }

  return reconciliation;
}

/**
 * Check if PAN is mandatory for a transaction
 */
function isPanMandatory(transactionType, amount) {
  const currentFy = getFinancialYear();
  const rules = require("../constants/tdsConfig").panRequirementRules;

  // GST business turnover check
  if (transactionType.includes("GST") || transactionType.includes("Sales")) {
    return amount >= rules.GST_BUSINESS.turnoverThreshold;
  }

  // Salary check
  if (transactionType.includes("Salary")) {
    return amount >= rules.SALARY.turnoverThreshold;
  }

  // Professional fees check
  if (transactionType.includes("Professional") || transactionType.includes("Consultancy")) {
    return amount >= rules.PROF_FEES.turnoverThreshold;
  }

  return false;
}

/**
 * Validate TDS certificate details
 */
function validateTdsCertificate(certificateData) {
  const errors = [];
  const warnings = [];

  // Check mandatory fields
  if (!certificateData.certificateNumber) errors.push("Certificate number is missing");
  if (!certificateData.certificateType) errors.push("Certificate type is missing");
  if (!certificateData.financialYear) errors.push("Financial year is missing");
  if (!certificateData.totalTdsDeducted) warnings.push("No TDS deducted");

  // Check if sections are valid
  if (certificateData.summaryBySection) {
    Object.keys(certificateData.summaryBySection).forEach((section) => {
      if (!tdsConfigs[section] && section !== "NONE") {
        errors.push(`Invalid TDS section: ${section}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  calculateTds,
  suggestTdsSection,
  generateTdsCertificate,
  reconcileForm26As,
  isPanMandatory,
  validateTdsCertificate,
};

// Enhanced constants for Indian accounting compliance

// Invoice Types as per Indian accounting standards
const invoiceTypes = {
  TAX_INVOICE: {
    code: "TI",
    name: "Tax Invoice",
    description: "Normal invoice with GST",
    gstiApplicable: true,
    regulationType: "GST",
  },
  BILL_OF_SUPPLY: {
    code: "BOS",
    name: "Bill of Supply",
    description: "For non-taxable or exempted goods",
    gstiApplicable: false,
    regulationType: "GST",
  },
  DEBIT_NOTE: {
    code: "DN",
    name: "Debit Note",
    description: "To recover short/overcharged amount",
    gstiApplicable: true,
    regulationType: "GST",
  },
  CREDIT_NOTE: {
    code: "CN",
    name: "Credit Note",
    description: "Return or adjustment of goods/services",
    gstiApplicable: true,
    regulationType: "GST",
  },
  PROFORMA_INVOICE: {
    code: "PI",
    name: "Proforma Invoice",
    description: "Preliminary invoice before actual transaction",
    gstiApplicable: false,
    regulationType: "GENERAL",
  },
};

// Bank Transaction Types specific to Indian banking
const bankTransactionTypes = {
  CHEQUE: {
    name: "Cheque",
    code: "CHQ",
    processingTime: "3-5 days", // In India
    clearingType: "Local Clearing",
  },
  NEFT: {
    name: "NEFT Transfer",
    code: "NEFT",
    processingTime: "Real-time / Next-settlement",
    clearingType: "RTGS/NEFT Clearing",
    minimumAmount: 1,
    maximumAmount: null,
  },
  RTGS: {
    name: "RTGS Transfer",
    code: "RTGS",
    processingTime: "Real-time",
    clearingType: "RTGS Clearing",
    minimumAmount: 200000, // 2 lakh
    maximumAmount: null,
  },
  UPI: {
    name: "UPI Transfer",
    code: "UPI",
    processingTime: "Instant",
    clearingType: "UPI Network",
    minimumAmount: 1,
    maximumAmount: 100000, // 1 lakh limit per transaction (varies by bank),
  },
  IMPS: {
    name: "IMPS Transfer",
    code: "IMPS",
    processingTime: "Instant",
    clearingType: "IFS Clearing",
    minimumAmount: 1,
    maximumAmount: 1000000, // 10 lakh per transaction (varies)
  },
  SWIFT: {
    name: "International Transfer",
    code: "SWIFT",
    processingTime: "1-3 business days",
    clearingType: "SWIFT Clearing",
    currency: "Foreign Currency",
  },
  ECHEQUE: {
    name: "E-Cheque",
    code: "ECHNQ",
    processingTime: "2-3 days",
    clearingType: "Electronic Clearing",
  },
  DEMAND_DRAFT: {
    name: "Demand Draft",
    code: "DD",
    processingTime: "Same day",
    clearingType: "Counter Clearance",
  },
  CARD_PAYMENT: {
    name: "Card Payment",
    code: "CARD",
    processingTime: "2-5 days",
    clearingType: "Card Network",
  },
  POS: {
    name: "POS Collection",
    code: "POS",
    processingTime: "1-2 days",
    clearingType: "Card Network",
  },
};

// Compliance Status Indicators
const complianceStatus = {
  FULLY_COMPLIANT: "FULLY_COMPLIANT",
  PARTIALLY_COMPLIANT: "PARTIALLY_COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  REQUIRES_ACTION: "REQUIRES_ACTION",
  INFO_MISSING: "INFO_MISSING",
};

// GST Registration types
const gstRegistrationTypes = {
  REGULAR: {
    name: "Regular",
    description: "Full GST registration with ITC eligibility",
    minTurnover: 2000000, // 20 lakh
    itcEligible: true,
    quarterlyFiling: false,
  },
  COMPOSITION: {
    name: "Composition Scheme",
    description: "Optional for turnover < 50 lakh",
    minTurnover: 0,
    maxTurnover: 5000000, // 50 lakh
    itcEligible: false,
    quarterlyFiling: false,
  },
  SEMI_REGULAR: {
    name: "Semi-Regular",
    description: "For turnover < 20 lakh",
    minTurnover: 0,
    maxTurnover: 2000000, // 20 lakh
    itcEligible: false,
    quarterlyFiling: true,
  },
};

// Document types for statutory records
const statutoryDocumentTypes = {
  GSTR1: "GSTR-1 (Outward Supplies)",
  GSTR2A: "GSTR-2A (Purchase Register)",
  GSTR2B: "GSTR-2B (ITC Eligible)",
  GSTR3B: "GSTR-3B (Monthly Return)",
  FORM_26AS: "Form 26AS (TDS Credit)",
  FORM_SCHEDULE_VA: "Schedule VA (Income Tax)",
  FORM_15H: "Form 15H (TDS Exemption)",
  FORM_15G: "Form 15G (TDS Exemption)",
};

// Compliance checklist for Indian companies
const complianceChecklistItems = [
  {
    id: "annual_gst_audit",
    category: "GST",
    item: "Annual GST Audit Closure",
    dueDate: "30 June",
    applicableTo: ["Regular GST", "Composition"],
  },
  {
    id: "quarterly_gstr3b",
    category: "GST",
    item: "Quarterly GSTR-3B Filing",
    dueDate: "End of Month + 20 Days",
    applicableTo: ["Regular GST"],
  },
  {
    id: "annual_audit",
    category: "Audit",
    item: "Annual Statutory Audit",
    dueDate: "30 September",
    applicableTo: ["Private Limited", "Public Limited"],
  },
  {
    id: "income_tax_return",
    category: "Income Tax",
    item: "Income Tax Return Filing",
    dueDate: "31 July",
    applicableTo: ["All"],
  },
  {
    id: "bank_reconciliation",
    category: "Internal",
    item: "Monthly Bank Reconciliation",
    dueDate: "Last day of month",
    applicableTo: ["All"],
  },
];

module.exports = {
  invoiceTypes,
  bankTransactionTypes,
  complianceStatus,
  gstRegistrationTypes,
  statutoryDocumentTypes,
  complianceChecklistItems,
};

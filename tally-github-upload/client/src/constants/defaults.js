export const createEmptyInvoice = (defaults = {}) => ({
  confidence: "medium",
  vendorName: "",
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  vendorGstin: "",
  subtotal: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  total: 0,
  lineItems: [
    {
      id: "line-1",
      description: "",
      hsnSacCode: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ],
  reviewNotes: [],
  tallyConfig: {
    companyName: "",
    purchaseLedgerName: defaults.purchaseLedgerName || "Purchase A/c",
    cgstLedgerName: defaults.cgstLedgerName || "Input CGST",
    sgstLedgerName: defaults.sgstLedgerName || "Input SGST",
    igstLedgerName: defaults.igstLedgerName || "Input IGST",
  },
});

export const createEmptyBankStatement = (defaults = {}) => ({
  confidence: "medium",
  summary: {
    periodStart: "",
    periodEnd: "",
    totalDebits: 0,
    totalCredits: 0,
    transactionCount: 0,
    reviewCount: 0,
  },
  transactions: [],
  reviewNotes: [],
  tallyConfig: {
    companyName: "",
    bankLedgerName: defaults.bankLedgerName || "Bank Account",
  },
  learningSummary: {
    learnedRuleCount: 0,
    recentInstructions: [],
  },
});

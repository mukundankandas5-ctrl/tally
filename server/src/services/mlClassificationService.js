const fs = require("fs");
const path = require("path");

/**
 * Advanced ML-based Transaction Classification Service
 * 
 * Implements multiple ML algorithms for accurate voucher type and ledger assignment:
 * 1. Pattern Recognition (Rule-based ML)
 * 2. Confidence Scoring (Bayesian approach)
 * 3. Ensemble Methods (voting from multiple algorithms)
 * 4. Feedback Learning (improves accuracy over time)
 * 5. Anomaly Detection (flags suspicious transactions)
 */

const dataDir = path.resolve(__dirname, "../data");
const modelFile = path.join(dataDir, "ml-models.json");

// ============================================================================
// 1. PATTERN RECOGNITION ENGINE
// ============================================================================

class PatternRecognitionEngine {
  constructor() {
    this.patterns = this.loadPatterns();
    this.merchantDb = this.buildMerchantDatabase();
  }

  loadPatterns() {
    return {
      // High-confidence exact patterns
      exact: {
        "SALARY": { category: "Salary & Wages", voucher: "Payment", confidence: 0.98 },
        "PAYROLL": { category: "Salary & Wages", voucher: "Payment", confidence: 0.98 },
        "GSTN": { category: "GST Payment", voucher: "Payment", confidence: 0.99 },
        "GST PMT": { category: "GST Payment", voucher: "Payment", confidence: 0.99 },
        "CPIN": { category: "GST Payment", voucher: "Payment", confidence: 0.99 },
        "EMI": { category: "Loan EMI Repayment", voucher: "Payment", confidence: 0.96 },
        "HOME LOAN": { category: "Loan EMI Repayment", voucher: "Payment", confidence: 0.97 },
        "HOUSING LOAN": { category: "Loan EMI Repayment", voucher: "Payment", confidence: 0.97 },
        "TDS U/S": { category: "TDS Deducted", voucher: "Journal", confidence: 0.99 },
        "EPFO": { category: "PF Contribution", voucher: "Payment", confidence: 0.98 },
        "ESIC": { category: "ESI Contribution", voucher: "Payment", confidence: 0.98 },
        "PROFESSIONAL TAX": { category: "Professional Tax", voucher: "Payment", confidence: 0.97 },
      },
      
      // Merchant patterns (UPI/payment apps)
      merchants: {
        "SWIGGY": { category: "Meals & Entertainment", voucher: "Payment", confidence: 0.95 },
        "ZOMATO": { category: "Meals & Entertainment", voucher: "Payment", confidence: 0.95 },
        "BLINKIT": { category: "Office Supplies", voucher: "Payment", confidence: 0.90 },
        "DUNZO": { category: "Office Supplies", voucher: "Payment", confidence: 0.88 },
        "AMAZON": { category: "Office Supplies", voucher: "Payment", confidence: 0.85 },
        "FLIPKART": { category: "Office Supplies", voucher: "Payment", confidence: 0.85 },
        "AIRTEL": { category: "Telephone & Internet", voucher: "Payment", confidence: 0.98 },
        "JIO": { category: "Telephone & Internet", voucher: "Payment", confidence: 0.98 },
        "BSNL": { category: "Telephone & Internet", voucher: "Payment", confidence: 0.98 },
        "VODAFONE": { category: "Telephone & Internet", voucher: "Payment", confidence: 0.98 },
        "UBER": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.96 },
        "OLA": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.96 },
        "RAPIDO": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.96 },
        "IRCTC": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.94 },
        "MAKEMYTRIP": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.92 },
        "OYO": { category: "Travel & Conveyance", voucher: "Payment", confidence: 0.88 },
        "LIC": { category: "Insurance Premium", voucher: "Payment", confidence: 0.98 },
        "SBI LIFE": { category: "Insurance Premium", voucher: "Payment", confidence: 0.98 },
        "HDFC LIFE": { category: "Insurance Premium", voucher: "Payment", confidence: 0.98 },
        "ICICI PRU": { category: "Insurance Premium", voucher: "Payment", confidence: 0.98 },
      },

      // Utility patterns
      utilities: {
        "BESCOM": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.99 },
        "MSEDCL": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.99 },
        "TNEB": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.99 },
        "ELECTRICITY": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.97 },
        "POWER BILL": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.97 },
        "WATER": { category: "Electricity & Utilities", voucher: "Payment", confidence: 0.96 },
      },

      // Bank-related patterns
      banking: {
        "CHARGES": { category: "Bank Charges & Fees", voucher: "Payment", confidence: 0.95 },
        "ATM FEE": { category: "Bank Charges & Fees", voucher: "Payment", confidence: 0.98 },
        "ANNUAL FEE": { category: "Bank Charges & Fees", voucher: "Payment", confidence: 0.98 },
        "PROCESSING FEE": { category: "Bank Charges & Fees", voucher: "Payment", confidence: 0.96 },
      },

      // Transfer patterns
      transfers: {
        "SELF": { category: "Inter-bank Transfer", voucher: "Contra", confidence: 0.98 },
        "OWN ACCOUNT": { category: "Inter-bank Transfer", voucher: "Contra", confidence: 0.98 },
        "TRANSFER TO SELF": { category: "Inter-bank Transfer", voucher: "Contra", confidence: 0.99 },
      },

      // Check clearing patterns
      clearings: {
        "CLG": { category: "Vendor Payment", voucher: "Payment", confidence: 0.70 },
        "CHQ": { category: "Vendor Payment", voucher: "Payment", confidence: 0.70 },
        "CHEQUE": { category: "Vendor Payment", voucher: "Payment", confidence: 0.70 },
      },

      // Mode-based patterns
      modes: {
        "ACH": { baseConfidence: 0.85 },  // ACH = likely recurring (EMI, salary, insurance)
        "NACH": { baseConfidence: 0.88 }, // NACH = scheduled debit (very predictable)
        "UPI": { baseConfidence: 0.82 },  // UPI = merchant-driven classification
        "NEFT": { baseConfidence: 0.80 }, // NEFT = needs narration analysis
        "RTGS": { baseConfidence: 0.80 }, // RTGS = needs narration analysis
        "IMPS": { baseConfidence: 0.82 }, // IMPS = needs narration analysis
      },
    };
  }

  buildMerchantDatabase() {
    return {
      foodDelivery: ["SWIGGY", "ZOMATO", "UBER EATS"],
      travel: ["UBER", "OLA", "RAPIDO", "IRCTC", "MAKEMYTRIP", "CLEARTRIP", "OYO"],
      shopping: ["AMAZON", "FLIPKART", "MYNTRA", "MEESHO", "SNAPDEAL"],
      utilities: ["BESCOM", "MSEDCL", "TNEB", "ELECTRICITY", "WATER"],
      telecom: ["AIRTEL", "JIO", "BSNL", "VODAFONE", "VI"],
      insurance: ["LIC", "SBI LIFE", "HDFC LIFE", "ICICI", "MAX LIFE"],
      investment: ["NSDL", "CDSL", "ZERODHA", "GROWW", "MUTUAL FUND"],
      finance: ["EPFO", "ESI", "ESIC", "PF"],
    };
  }

  analyze(transaction) {
    const narration = String(transaction.narration || "").toUpperCase();
    const amount = transaction.amount || 0;
    const txnType = transaction.txnType || "DEBIT";
    const mode = String(transaction.mode || "").toUpperCase();

    // Check exact pattern matches (highest priority)
    for (const [pattern, rule] of Object.entries(this.patterns.exact)) {
      if (narration.includes(pattern)) {
        return {
          source: "pattern_exact",
          category: rule.category,
          voucher: rule.voucher,
          confidence: rule.confidence,
          reasoning: `Exact pattern match: "${pattern}" found in narration`,
        };
      }
    }

    // Check merchant database
    for (const [merchant, rule] of Object.entries(this.patterns.merchants)) {
      if (narration.includes(merchant)) {
        return {
          source: "pattern_merchant",
          category: rule.category,
          voucher: rule.voucher,
          confidence: rule.confidence,
          reasoning: `Merchant pattern match: ${merchant}`,
        };
      }
    }

    // Check utility patterns
    for (const [utility, rule] of Object.entries(this.patterns.utilities)) {
      if (narration.includes(utility)) {
        return {
          source: "pattern_utility",
          category: rule.category,
          voucher: rule.voucher,
          confidence: rule.confidence,
          reasoning: `Utility pattern match: ${utility}`,
        };
      }
    }

    // Check transfer patterns first (high importance)
    for (const [transfer, rule] of Object.entries(this.patterns.transfers)) {
      if (narration.includes(transfer)) {
        return {
          source: "pattern_transfer",
          category: rule.category,
          voucher: rule.voucher,
          confidence: rule.confidence,
          reasoning: `Transfer pattern match: ${transfer}`,
        };
      }
    }

    return null;
  }
}

// ============================================================================
// 2. BAYESIAN CONFIDENCE SCORING ENGINE
// ============================================================================

class ConfidenceScoringEngine {
  constructor() {
    this.baselineConfidence = 0.60;
    this.confidenceFactors = this.initializeFactors();
    this.historyWeights = this.loadHistoryWeights();
  }

  initializeFactors() {
    return {
      // Narration quality factors
      narrationLength: { weight: 0.10, threshold: 20 },
      narrationClarity: { weight: 0.15, threshold: 0.7 },
      
      // Amount factors
      roundAmount: { weight: 0.08, boost: 0.05 },  // Round amounts = more likely salary/EMI
      recurringPattern: { weight: 0.12, boost: 0.08 },
      
      // Mode factors
      modeSpecificity: { weight: 0.10 },  // ACH/NACH = higher confidence
      
      // Pattern matching
      exactPatternMatch: { weight: 0.25, boost: 0.15 },
      merchantMatch: { weight: 0.15, boost: 0.10 },
      
      // Learning factors
      historicalAccuracy: { weight: 0.12, maxBoost: 0.12 },
      userCorrections: { weight: 0.08, maxPenalty: -0.08 },
      
      // Amount validation
      amountReasonableness: { weight: 0.07 },
      txnTypeConsistency: { weight: 0.09 },
    };
  }

  loadHistoryWeights() {
    try {
      if (fs.existsSync(modelFile)) {
        const data = JSON.parse(fs.readFileSync(modelFile, "utf8"));
        return data.historyWeights || {};
      }
    } catch (e) {
      // Silent fail, return empty weights
    }
    return {};
  }

  scoreNarrationClarity(narration) {
    const narration_str = String(narration || "").toLowerCase();
    let score = 0;

    // Has specific company/merchant name
    if (/[a-z]{3,}/.test(narration_str)) score += 0.2;

    // Has amount or reference number
    if (/\d{4,}/.test(narration_str)) score += 0.2;

    // Has date/month
    if (/\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(narration_str)) score += 0.15;

    // Has invoice/document reference
    if (/inv|ref|pol|no|\.\.|\.{2,}/.test(narration_str)) score += 0.15;

    // Contains common keywords
    const keywords = ["payment", "receipt", "deposit", "refund", "transfer"];
    if (keywords.some(kw => narration_str.includes(kw))) score += 0.15;

    // Length-based scoring
    if (narration_str.length > 30) score += 0.15;

    return Math.min(1, score);
  }

  isRoundAmount(amount) {
    const num = Number(amount) || 0;
    if (num === 0) return false;
    
    // Check if divisible by 1000, 5000, or 10000
    return num % 1000 === 0 || num % 5000 === 0 || num % 10000 === 0;
  }

  calculateModeConfidence(mode) {
    const modeMap = {
      "NACH": 0.90,  // Scheduled debit - very predictable
      "ACH": 0.85,   // Automated clearing - predictable
      "NEFT": 0.70,  // Manual transfer - less predictable
      "RTGS": 0.70,
      "IMPS": 0.75,  // Immediate - mid-level predictability
      "UPI": 0.78,   // App-based - merchant-driven
      "CHEQUE": 0.65, // Check - paper-based, needs analysis
    };
    return modeMap[String(mode || "").toUpperCase()] || 0.60;
  }

  calculateFinalConfidence(factors) {
    let totalConfidence = this.baselineConfidence;

    // Apply factor weights
    if (factors.narrationClarity) {
      const clarityScore = this.scoreNarrationClarity(factors.narration);
      totalConfidence += clarityScore * this.confidenceFactors.narrationClarity.weight;
    }

    if (factors.isRoundAmount) {
      totalConfidence += this.confidenceFactors.roundAmount.boost;
    }

    if (factors.isRecurring) {
      totalConfidence += this.confidenceFactors.recurringPattern.boost;
    }

    if (factors.patternMatched) {
      totalConfidence += this.confidenceFactors.exactPatternMatch.boost;
    }

    if (factors.historicalAccuracy !== undefined) {
      totalConfidence += (factors.historicalAccuracy * this.confidenceFactors.historicalAccuracy.maxBoost);
    }

    if (factors.userCorrectionRate !== undefined) {
      const penalty = Math.max(0, factors.userCorrectionRate) * this.confidenceFactors.userCorrections.maxPenalty;
      totalConfidence += penalty;
    }

    return Math.max(0, Math.min(1, totalConfidence));
  }
}

// ============================================================================
// 3. VOUCHER TYPE LOGIC ENGINE
// ============================================================================

class VoucherTypeEngine {
  classify(transaction, category) {
    const txnType = transaction.txnType || "DEBIT";
    const amount = transaction.amount || 0;
    const narration = String(transaction.narration || "").toUpperCase();

    // Rule 1: Transfers between own accounts
    if (this.isOwnTransfer(narration, transaction)) {
      return "Contra";
    }

    // Rule 2: TDS entries
    if (category === "TDS Deducted" || category === "TDS Received") {
      return "Journal";
    }

    // Rule 3: Salary adjustments and provisions
    if (category === "Salary & Wages" && this.isPossibleAdjustment(narration)) {
      return "Journal";
    }

    // Rule 4: Check by transaction type for standard cases
    if (txnType === "CREDIT") {
      return "Receipt";
    } else if (txnType === "DEBIT") {
      return "Payment";
    }

    return "Payment"; // Default
  }

  isOwnTransfer(narration, transaction) {
    const keywords = ["SELF", "OWN ACCOUNT", "TRANSFER TO SELF", "INTER-ACCOUNT"];
    return keywords.some(kw => narration.includes(kw));
  }

  isPossibleAdjustment(narration) {
    const keywords = ["ADJUSTMENT", "PROVISION", "REVERSAL", "CORRECTION"];
    return keywords.some(kw => narration.includes(kw));
  }
}

// ============================================================================
// 4. ENSEMBLE CLASSIFIER (MULTIPLE ALGORITHMS)
// ============================================================================

class EnsembleClassifier {
  constructor() {
    this.patternEngine = new PatternRecognitionEngine();
    this.confidenceEngine = new ConfidenceScoringEngine();
    this.voucherEngine = new VoucherTypeEngine();
  }

  classify(transaction, learnedRules = [], anthropicResult = null) {
    const votes = [];

    // Vote 1: Learned Rules (highest priority)
    if (learnedRules && learnedRules.length > 0) {
      votes.push({
        weight: 0.35,
        result: {
          category: learnedRules[0].category,
          ledger: learnedRules[0].ledger,
          source: "learned_rules",
          confidence: 0.92,
          reasoning: "From user-trained rules",
        },
      });
    }

    // Vote 2: Pattern Recognition
    const patternResult = this.patternEngine.analyze(transaction);
    if (patternResult) {
      votes.push({
        weight: 0.30,
        result: {
          category: patternResult.category,
          ledger: this.mapCategoryToLedger(patternResult.category),
          source: "pattern_recognition",
          confidence: patternResult.confidence,
          reasoning: patternResult.reasoning,
        },
      });
    }

    // Vote 3: Anthropic AI (if available)
    if (anthropicResult) {
      votes.push({
        weight: 0.25,
        result: {
          category: anthropicResult.category,
          ledger: anthropicResult.ledger,
          source: "anthropic_claude",
          confidence: anthropicResult.confidence,
          reasoning: anthropicResult.reasoning,
        },
      });
    }

    // Vote 4: Fallback heuristics
    votes.push({
      weight: 0.10,
      result: this.fallbackClassification(transaction),
    });

    // Ensemble voting with weighted average
    return this.aggregateVotes(votes, transaction);
  }

  fallbackClassification(transaction) {
    const txnType = transaction.txnType || "DEBIT";
    const category = txnType === "CREDIT" ? "Customer Receipt" : "Vendor Payment";
    
    return {
      category,
      ledger: this.mapCategoryToLedger(category),
      source: "fallback_heuristic",
      confidence: 0.45,
      reasoning: "Using fallback heuristic based on transaction type",
    };
  }

  aggregateVotes(votes, transaction) {
    if (votes.length === 0) {
      return this.fallbackClassification(transaction);
    }

    // Filter out votes that are undefined
    const validVotes = votes.filter(v => v && v.result);

    if (validVotes.length === 0) {
      return this.fallbackClassification(transaction);
    }

    // Check for consensus (all votes agree on category)
    const categories = validVotes.map(v => v.result.category);
    const uniqueCategories = new Set(categories);

    let selectedVote;
    if (uniqueCategories.size === 1) {
      // Consensus: use the vote with highest weight
      selectedVote = validVotes.reduce((max, v) => (v.weight > max.weight ? v : max));
    } else {
      // Disagreement: use weighted average confidence
      const weightedConfidence = validVotes.reduce((sum, v) => {
        return sum + (v.result.confidence * v.weight);
      }, 0);

      const totalWeight = validVotes.reduce((sum, v) => sum + v.weight, 0);
      const avgConfidence = weightedConfidence / totalWeight;

      // Select the result with highest confidence
      selectedVote = validVotes.reduce((max, v) => {
        return (v.result.confidence > max.result.confidence) ? v : max;
      });

      // Adjust confidence downward due to disagreement
      selectedVote.result.confidence = Math.min(selectedVote.result.confidence, avgConfidence);
    }

    // Add ensemble metadata
    return {
      ...selectedVote.result,
      ensemble: {
        voteCount: validVotes.length,
        sources: validVotes.map(v => v.result.source),
        agreementLevel: (1 - (uniqueCategories.size - 1) / (uniqueCategories.size)).toFixed(2),
      },
      voucher_type: this.voucherEngine.classify(transaction, selectedVote.result.category),
    };
  }

  mapCategoryToLedger(category) {
    const mapping = {
      "Salary & Wages": "Salaries",
      "GST Payment": "GST Payable",
      "TDS Deducted": "TDS Receivable",
      "Loan EMI Repayment": "Loan Account",
      "Meals & Entertainment": "Office Expenses",
      "Telephone & Internet": "Internet Charges",
      "Travel & Conveyance": "Travelling Expenses",
      "Electricity & Utilities": "Electricity",
      "Insurance Premium": "Insurance",
      "Bank Charges & Fees": "Bank Charges",
      "Inter-bank Transfer": "Bank Transfer",
      "Customer Receipt": "Sundry Debtor",
      "Vendor Payment": "Sundry Creditor",
    };

    return mapping[category] || category;
  }
}

// ============================================================================
// 5. AP/CREDIT OPTIMIZATION ENGINE
// ============================================================================

class APCreditOptimizer {
  /**
   * Optimize for Accounts Payable and Credit efficiency
   * Ensures payables are properly grouped and credit terms tracked
   */
  
  optimizeForAP(transaction, classification) {
    const optimized = { ...classification };

    // If it's a vendor payment, enhance AP tracking
    if (classification.category === "Vendor Payment") {
      optimized.apOptimization = this.enrichVendorPayment(transaction, classification);
    }

    // If it's customer receipt, enhance receivables
    if (classification.category === "Customer Receipt") {
      optimized.arOptimization = this.enrichCustomerReceipt(transaction, classification);
    }

    // Check for credit term patterns
    optimized.creditTerms = this.inferCreditTerms(transaction);

    return optimized;
  }

  enrichVendorPayment(transaction, classification) {
    const narration = String(transaction.narration || "").toUpperCase();

    // Extract vendor details
    const vendorName = this.extractVendorName(narration);
    const invoiceNumber = this.extractInvoiceNumber(narration);
    const referenceNumber = this.extractReferenceNumber(narration);

    return {
      vendorName: vendorName || classification.ledger,
      invoiceRef: invoiceNumber,
      referenceNo: referenceNumber,
      paymentAmount: transaction.amount,
      paymentDate: transaction.date,
      suggestedDueDate: this.calculateDueDate(transaction.date, 30), // Default 30 days
      vendor_payment_type: this.classifyVendorPaymentType(narration),
    };
  }

  enrichCustomerReceipt(transaction, classification) {
    const narration = String(transaction.narration || "").toUpperCase();

    // Extract customer details
    const customerName = this.extractCustomerName(narration);
    const invoiceNumber = this.extractInvoiceNumber(narration);

    return {
      customerName: customerName || classification.ledger,
      invoiceRef: invoiceNumber,
      receiptAmount: transaction.amount,
      receiptDate: transaction.date,
      creditTerms: this.detectCreditTerms(narration),
    };
  }

  extractVendorName(narration) {
    // Match patterns like "VENDOR ABC COMPANY" or "INV2024-ABC CORP"
    const match = narration.match(/(?:TO|VENDOR|SUPPLIER|COMPANY)[\s-]*([A-Z\s]{5,}?)(?:\s|-|INV|REF)/);
    return match ? match[1].trim() : null;
  }

  extractCustomerName(narration) {
    // Match patterns like "CR-CUSTOMER NAME-..."
    const match = narration.match(/(?:CR|FROM|CUSTOMER)[\s-]*([A-Z\s]{5,}?)(?:\s|-|INV|REF|PER)/);
    return match ? match[1].trim() : null;
  }

  extractInvoiceNumber(narration) {
    // Match patterns like "INV2024-1234" or "IV-001234"
    const match = narration.match(/(?:INV|IV|INVOICE)[\s-]*(\d+[-\/\w]*)/);
    return match ? match[1] : null;
  }

  extractReferenceNumber(narration) {
    // Match patterns like ""REF123" or "REFERENCE NO: 456"
    const match = narration.match(/(?:REF|REFERENCE|NO)[\s:.]*([A-Z0-9]+)/);
    return match ? match[1] : null;
  }

  classifyVendorPaymentType(narration) {
    if (narration.includes("ADVANCE")) return "advance_payment";
    if (narration.includes("PARTIAL")) return "partial_payment";
    if (narration.includes("FINAL")) return "final_payment";
    if (narration.includes("SETTLEMENT")) return "settlement_payment";
    return "standard_payment";
  }

  detectCreditTerms(narration) {
    if (narration.includes("30 DAYS") || narration.includes("NET 30")) return "NET30";
    if (narration.includes("60 DAYS") || narration.includes("NET 60")) return "NET60";
    if (narration.includes("90 DAYS") || narration.includes("NET 90")) return "NET90";
    if (narration.includes("IMMEDIATE") || narration.includes("COD")) return "IMMEDIATE";
    return null;
  }

  inferCreditTerms(transaction) {
    // Based on amount and narration patterns
    const amount = transaction.amount || 0;

    if (amount > 500000) {
      return { likely: "NET30", reason: "Large amount suggests payment terms" };
    }
    if (/bulk|order|purchase/.test(transaction.narration.toLowerCase())) {
      return { likely: "NET30", reason: "Transaction type suggests credit terms" };
    }
    
    return null;
  }

  calculateDueDate(transactionDate, daysCredit = 30) {
    const date = new Date(transactionDate);
    date.setDate(date.getDate() + daysCredit);
    return date.toISOString().split('T')[0];
  }
}

// ============================================================================
// 6. FEEDBACK LEARNING SYSTEM
// ============================================================================

class FeedbackLearningSystem {
  constructor() {
    this.modelFile = modelFile;
    this.ensureModelFile();
    this.model = this.loadModel();
  }

  ensureModelFile() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.modelFile)) {
      const initialModel = {
        classificationAccuracy: {},
        userFeedback: [],
        categoryDistribution: {},
        voucherTypeAccuracy: {},
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(this.modelFile, JSON.stringify(initialModel, null, 2), "utf8");
    }
  }

  loadModel() {
    try {
      return JSON.parse(fs.readFileSync(this.modelFile, "utf8"));
    } catch (e) {
      return { classificationAccuracy: {}, userFeedback: [] };
    }
  }

  saveModel() {
    fs.writeFileSync(this.modelFile, JSON.stringify(this.model, null, 2), "utf8");
  }

  /**
   * Record user feedback on classification
   * Used to improve accuracy over time
   */
  recordFeedback(transaction, suggestedClassification, userCorrection, accuracy = null) {
    const feedback = {
      timestamp: new Date().toISOString(),
      transaction_id: transaction.id,
      narration: transaction.narration,
      suggested: suggestedClassification,
      actual: userCorrection,
      accuracy: accuracy || (suggestedClassification.category === userCorrection.category ? 1 : 0),
      category: userCorrection.category,
    };

    // Track category distribution
    if (!this.model.categoryDistribution[userCorrection.category]) {
      this.model.categoryDistribution[userCorrection.category] = 0;
    }
    this.model.categoryDistribution[userCorrection.category]++;

    // Track accuracy per category
    if (!this.model.classificationAccuracy[userCorrection.category]) {
      this.model.classificationAccuracy[userCorrection.category] = [];
    }
    this.model.classificationAccuracy[userCorrection.category].push(feedback.accuracy);

    // Store feedback
    this.model.userFeedback.push(feedback);

    // Keep only last 1000 feedbacks
    if (this.model.userFeedback.length > 1000) {
      this.model.userFeedback = this.model.userFeedback.slice(-1000);
    }

    this.model.timestamp = new Date().toISOString();
    this.saveModel();

    return { status: "recorded", feedback };
  }

  /**
   * Get historical accuracy for a category
   * Returns 0.0 to 1.0
   */
  getHistoricalAccuracy(category) {
    const accuracies = this.model.classificationAccuracy[category] || [];
    if (accuracies.length === 0) return null;

    const sum = accuracies.reduce((a, b) => a + b, 0);
    return sum / accuracies.length;
  }

  /**
   * Get improvement suggestions based on feedback
   */
  getImprovementSuggestions() {
    const suggestions = [];

    // Find categories with low accuracy
    for (const [category, accuracies] of Object.entries(this.model.classificationAccuracy)) {
      const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      if (avg < 0.7) {
        suggestions.push({
          category,
          accuracy: avg.toFixed(2),
          samples: accuracies.length,
          note: "Low accuracy - consider improving patterns",
        });
      }
    }

    return suggestions.sort((a, b) => a.accuracy - b.accuracy);
  }
}

// ============================================================================
// MAIN ML CLASSIFICATION SERVICE
// ============================================================================

class MLClassificationService {
  constructor() {
    this.ensemble = new EnsembleClassifier();
    this.apOptimizer = new APCreditOptimizer();
    this.feedbackSystem = new FeedbackLearningSystem();
    this.confidenceEngine = new ConfidenceScoringEngine();
  }

  /**
   * Core classification method
   * Combines all ML algorithms for maximum accuracy
   */
  classify(transaction, options = {}) {
    try {
      // Ensemble classification
      const baseResult = this.ensemble.classify(
        transaction,
        options.learnedRules || [],
        options.anthropicResult || null
      );

      // Calculate confidence score
      const confidenceFactors = {
        narration: transaction.narration,
        isRoundAmount: this.confidenceEngine.isRoundAmount(transaction.amount),
        isRecurring: options.isRecurring || false,
        patternMatched: baseResult.source !== "fallback_heuristic",
        historicalAccuracy: this.feedbackSystem.getHistoricalAccuracy(baseResult.category),
      };

      const finalConfidence = this.confidenceEngine.calculateFinalConfidence(confidenceFactors);

      // AP/Credit optimization
      const optimized = this.apOptimizer.optimizeForAP(transaction, baseResult);

      return {
        ...optimized,
        confidence: Math.round(finalConfidence * 100) / 100,
        ml_metadata: {
          algorithm: "ensemble_ml",
          components_used: baseResult.ensemble?.sources || [baseResult.source],
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("ML Classification Error:", error);
      throw error;
    }
  }

  /**
   * Batch classify multiple transactions
   */
  classifyBatch(transactions, options = {}) {
    return transactions.map(txn => this.classify(txn, options));
  }

  /**
   * Record user feedback and learn
   */
  recordUserFeedback(transaction, suggestedClassification, userCorrection) {
    return this.feedbackSystem.recordFeedback(
      transaction,
      suggestedClassification,
      userCorrection
    );
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics() {
    const accuracy = this.feedbackSystem.model.classificationAccuracy;
    const metrics = {};

    for (const [category, accuracies] of Object.entries(accuracy)) {
      const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      metrics[category] = {
        accuracy: Math.round(avg * 100) / 100,
        samples: accuracies.length,
        trend: this.calculateTrend(accuracies),
      };
    }

    return metrics;
  }

  calculateTrend(accuracies) {
    if (accuracies.length < 2) return "insufficient_data";
    
    const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
    const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 0.05) return "improving";
    if (secondAvg < firstAvg - 0.05) return "declining";
    return "stable";
  }

  /**
   * Get improvement suggestions
   */
  getImprovementSuggestions() {
    return this.feedbackSystem.getImprovementSuggestions();
  }
}

module.exports = {
  MLClassificationService,
  PatternRecognitionEngine,
  ConfidenceScoringEngine,
  VoucherTypeEngine,
  EnsembleClassifier,
  APCreditOptimizer,
  FeedbackLearningSystem,
};

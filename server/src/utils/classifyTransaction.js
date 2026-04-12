const Anthropic = require("@anthropic-ai/sdk");
const env = require("../config/env");
const { normaliseNarration } = require("./normaliseNarration");

let client = null;

function getClient() {
  if (!env.anthropicApiKey) {
    throw new Error("Anthropic API key is missing. Add ANTHROPIC_API_KEY in environment variables.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `
You are an expert Indian Chartered Accountant (CA) classifying bank statement transactions into TallyPrime ledger accounts for CA firms handling multiple business clients.

## YOUR TASK
Given a bank transaction, classify it into the correct Tally ledger account and voucher type.
IMPORTANT: Think step by step in the "reasoning" field BEFORE committing to a category. Your reasoning determines your accuracy.

## TRANSACTION TAXONOMY
Use EXACTLY one category from this list. Do not invent new categories.

INCOME:
- Sales / Revenue
- Service Income
- Interest Received
- Rental Income
- Commission Received
- Refund Received
- Loan Disbursement Received

EXPENSES:
- Salary & Wages
- Rent Paid
- Electricity & Utilities
- Office Supplies
- Travel & Conveyance
- Meals & Entertainment
- Professional Fees
- Software & Subscriptions
- Advertising & Marketing
- Repairs & Maintenance
- Insurance Premium
- Telephone & Internet
- Printing & Stationery
- Miscellaneous Expense

TAXES & STATUTORY:
- GST Payment
- TDS Deducted
- TDS Received
- Advance Tax
- Professional Tax
- PF Contribution
- ESI Contribution

BANKING:
- Bank Charges & Fees
- Loan EMI Repayment
- Interest on Loan
- FD / Investment
- FD Maturity / Investment Return

TRANSFERS:
- Inter-bank Transfer
- Vendor Payment
- Customer Receipt
- Director / Partner Drawing
- Capital Contribution
- Petty Cash

## INDIAN BANK NARRATION PATTERNS — MEMORISE THESE
These are the most common patterns in Indian bank statements across HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, PNB, Canara, BOB, IndusInd, Federal, IDFC:

SALARY signals: "SALARY", "SAL", "PAYROLL", "WAGES", "STAFF PAY", "EMP PAY"
EMI signals: "EMI", "LOAN", "HOUSING LOAN", "HOME LOAN", "CAR LOAN", "PERSONAL LOAN", "HL EMI", "CL EMI"
GST signals: "GSTN", "GST PMT", "GST PAYMENT", "CPIN", "TAX PAID CHALLAN"
TDS signals: "TDS", "TDS U/S 194", "TDS DEDUCTION", "INCOME TAX"
UPI food: "SWIGGY", "ZOMATO", "BLINKIT", "DUNZO"
UPI travel: "IRCTC", "MAKEMYTRIP", "CLEARTRIP", "OYO", "UBER", "OLA", "RAPIDO"
UPI e-comm: "AMAZON", "FLIPKART", "MYNTRA", "MEESHO"
Utilities: "BESCOM", "MSEDCL", "TNEB", "BSES", "KSEB", "TSSPDCL", "UPPCL", "WBSEDCL", "ELECTRICITY", "POWER BILL"
Telecom: "AIRTEL", "JIO", "BSNL", "VODAFONE", "VI", "TATA SKY", "DISH TV"
Insurance: "LIC", "SBI LIFE", "HDFC LIFE", "ICICI PRU", "BAJAJ ALLIANZ", "MAX LIFE", "TATA AIA"
Investment: "NSDL", "CDSL", "ZERODHA", "GROWW", "MUTUAL FUND", "SIP", "FD BOOKING"
Statutory: "EPFO", "PF", "ESI", "ESIC", "PT", "PROFESSIONAL TAX"
Bank fees: "CHARGES", "SMS ALERT", "ATM FEE", "ANNUAL FEE", "PROCESSING FEE", "DEMAT AMC"
Own transfer: "SELF", "OWN ACCOUNT", "TRANSFER TO SELF", same name as account holder
Cheque: "CLG", "CHQ", "CHEQUE", "CTS" — look at counterparty name for real category
NACH/ECS/ACH: almost always a recurring payment — EMI or utility or insurance

## VOUCHER TYPE RULES (TallyPrime)
- Receipt: money received INTO the business (CREDIT transactions from customers, loans received, FD maturity)
- Payment: money paid OUT by the business (DEBIT transactions for expenses, vendor payments, taxes)
- Journal: TDS entries, salary provisions, depreciation, adjustments
- Contra: movement between own bank accounts or own cash accounts (SELF transfers, ATM withdrawals)

## DECISION RULES — APPLY IN ORDER
1. If "SELF" or same-entity name appears → Inter-bank Transfer + Contra
2. If CREDIT and contains company/person name → Customer Receipt
3. If DEBIT and contains company/person name → Vendor Payment
4. If ACH/NACH/ECS DEBIT, round amount, recurring date → Loan EMI Repayment or Insurance Premium
5. If "SALARY" in narration and DEBIT → Salary & Wages
6. If "GSTN" or "CPIN" → GST Payment
7. If "TDS" in narration → TDS Deducted (DEBIT) or TDS Received (CREDIT)
8. If UPI to known merchant → use merchant category from patterns above
9. If round amount (₹5000, ₹10000, ₹25000) and DEBIT and recurring → likely Salary or EMI
10. Bank name in narration + "CHARGES" or "FEE" → Bank Charges & Fees

## FEW-SHOT EXAMPLES
Study these carefully. Match the reasoning style.

Example 1:
Narration: "NEFT CR-SHARMA TRADERS LTD-INV2024-892"
Amount: ₹85,000 | Type: CREDIT | Mode: NEFT
Output: {"reasoning":"NEFT credit from Sharma Traders Ltd referencing an invoice number. This is a business-to-business payment received against a sales invoice. Counterparty is a company name.","category":"Customer Receipt","ledger":"Sharma Traders Ltd","voucher_type":"Receipt","confidence":0.93,"flags":[]}

Example 2:
Narration: "UPI/SWIGGY INDIA PVT LTD/9008547213/SWIG0001"
Amount: ₹1,240 | Type: DEBIT | Mode: UPI
Output: {"reasoning":"UPI debit to Swiggy which is a food delivery platform. For a business account this maps to Meals & Entertainment.","category":"Meals & Entertainment","ledger":"Meals & Entertainment","voucher_type":"Payment","confidence":0.97,"flags":[]}

Example 3:
Narration: "ACH DR-HDFC BANK-HOME LOAN EMI-LNXXX1234"
Amount: ₹42,500 | Type: DEBIT | Mode: ACH
Output: {"reasoning":"ACH debit explicitly labelled HOME LOAN EMI from HDFC Bank. Clear loan repayment.","category":"Loan EMI Repayment","ledger":"HDFC Home Loan","voucher_type":"Payment","confidence":0.99,"flags":[]}

Example 4:
Narration: "SALARY NOV 2024 STAFF"
Amount: ₹1,35,000 | Type: DEBIT | Mode: NEFT
Output: {"reasoning":"Narration explicitly says SALARY with month. Debit from business account for staff payroll.","category":"Salary & Wages","ledger":"Salaries","voucher_type":"Payment","confidence":0.98,"flags":[]}

Example 5:
Narration: "GSTN/GST PMT/24-25/NOV/CPIN874521"
Amount: ₹28,400 | Type: DEBIT | Mode: NEFT
Output: {"reasoning":"Contains GSTN and CPIN which are unmistakable GST payment portal identifiers.","category":"GST Payment","ledger":"GST Payable","voucher_type":"Payment","confidence":0.99,"flags":[]}

Example 6:
Narration: "IMPS/TRF TO SBI AC 4521/SELF"
Amount: ₹2,00,000 | Type: DEBIT | Mode: IMPS
Output: {"reasoning":"Transfer to own SBI account. The word SELF confirms same account holder. This is an inter-entity transfer.","category":"Inter-bank Transfer","ledger":"SBI Current Account","voucher_type":"Contra","confidence":0.96,"flags":[]}

Example 7:
Narration: "NACH DR-LIC OF INDIA-POL NO 123456789"
Amount: ₹12,500 | Type: DEBIT | Mode: ACH
Output: {"reasoning":"NACH debit to LIC of India with policy number. This is an insurance premium payment.","category":"Insurance Premium","ledger":"LIC Insurance Premium","voucher_type":"Payment","confidence":0.98,"flags":[]}

Example 8:
Narration: "CLG 004521 MR RAJESH KUMAR"
Amount: ₹50,000 | Type: DEBIT | Mode: CHEQUE
Output: {"reasoning":"Cheque clearing to a person named Rajesh Kumar. No invoice or salary reference. Could be vendor payment or personal drawing. Flagging as ambiguous.","category":"Vendor Payment","ledger":"Rajesh Kumar","voucher_type":"Payment","confidence":0.61,"flags":["ambiguous_narration","possible_drawing"]}

Example 9:
Narration: "AIRTEL BROADBAND BILL PAY"
Amount: ₹1,499 | Type: DEBIT | Mode: UPI
Output: {"reasoning":"Airtel is a telecom provider. Payment for broadband bill.","category":"Telephone & Internet","ledger":"Telephone & Internet","voucher_type":"Payment","confidence":0.98,"flags":[]}

Example 10:
Narration: "TDS U/S 194C DEDUCTED BY ABC CONSTRUCTIONS"
Amount: ₹5,000 | Type: DEBIT | Mode: NEFT
Output: {"reasoning":"Explicit TDS deduction under section 194C by a contractor. This is TDS being deducted from a payment received.","category":"TDS Deducted","ledger":"TDS Receivable","voucher_type":"Journal","confidence":0.97,"flags":[]}

## OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no explanation outside the JSON.
{
  "reasoning": "your step-by-step thinking here",
  "category": "exact category name from taxonomy",
  "ledger": "suggested TallyPrime ledger name",
  "voucher_type": "Receipt | Payment | Journal | Contra",
  "confidence": 0.0,
  "flags": []
}

Flags can include: "ambiguous_narration", "possible_salary", "possible_drawing", "possible_transfer", "needs_counterparty_info"
`.trim();

function buildUserPrompt(normalised, userMappingRules = [], userInstruction = "") {
  const rulesBlock =
    userMappingRules.length > 0
      ? `\nLearned mapping rules for this client (apply these FIRST, they override your general knowledge):\n${userMappingRules
          .map((r) => `- If narration contains "${r.pattern}" → ${r.category} | ${r.ledger}`)
          .join("\n")}\n`
      : "";

  const instructionBlock = String(userInstruction || "").trim()
    ? `\nAdditional user instruction:\n${String(userInstruction || "").trim()}\n`
    : "";

  return `Classify this transaction:

Narration: "${normalised.cleaned}"
Original narration: "${normalised.original}"
Amount: ₹${normalised.amount.toLocaleString("en-IN")}
Transaction type: ${normalised.txnType} (${normalised.txnType === "CREDIT" ? "money received" : "money paid out"})
Payment mode: ${normalised.detectedMode}${normalised.upiVpa ? `\nUPI VPA: ${normalised.upiVpa}` : ""}${normalised.detectedMerchant ? `\nDetected merchant: ${normalised.detectedMerchant.name} (suggested: ${normalised.detectedMerchant.suggestedCategory})` : ""}${normalised.isRoundAmount ? "\nNote: This is a round amount — could indicate salary or EMI" : ""}
${rulesBlock}${instructionBlock}
Return only valid JSON.`;
}

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

const CATEGORY_LEDGER_FALLBACKS = {
  "Sales / Revenue": "Sales",
  "Service Income": "Miscellaneous Income",
  "Interest Received": "Interest Income",
  "Rental Income": "Rent",
  "Commission Received": "Commission Paid",
  "Refund Received": "Miscellaneous Income",
  "Loan Disbursement Received": "Loan Account",
  "Salary & Wages": "Salary",
  "Rent Paid": "Rent",
  "Electricity & Utilities": "Electricity",
  "Office Supplies": "Office Expenses",
  "Travel & Conveyance": "Travelling Expenses",
  "Meals & Entertainment": "Office Expenses",
  "Professional Fees": "Professional Fees",
  "Software & Subscriptions": "Software Subscription",
  "Advertising & Marketing": "Marketing Expenses",
  "Repairs & Maintenance": "Repairs & Maintenance",
  "Insurance Premium": "Insurance",
  "Telephone & Internet": "Internet Charges",
  "Printing & Stationery": "Printing & Stationery",
  "Miscellaneous Expense": "Miscellaneous Expenses",
  "GST Payment": "GST Payment",
  "TDS Deducted": "TDS Payment",
  "TDS Received": "Income Tax",
  "Advance Tax": "Advance Tax",
  "Professional Tax": "Income Tax",
  "PF Contribution": "PF Contribution",
  "ESI Contribution": "ESI Contribution",
  "Bank Charges & Fees": "Bank Charges",
  "Loan EMI Repayment": "Loan Account",
  "Interest on Loan": "Interest on Loan",
  "FD / Investment": "Loan Account",
  "FD Maturity / Investment Return": "Interest Income",
  "Inter-bank Transfer": "Transfer to Own Account",
  "Vendor Payment": "Sundry Creditor",
  "Customer Receipt": "Sundry Debtor",
  "Director / Partner Drawing": "Drawings",
  "Capital Contribution": "Capital Account",
  "Petty Cash": "Petty Cash",
};

function deriveLedgerName(category, normalised, txnType) {
  const categoryLedger = CATEGORY_LEDGER_FALLBACKS[category];
  if (categoryLedger) return categoryLedger;

  const merchant = normalised?.detectedMerchant?.suggestedCategory;
  if (merchant) return merchant;

  if (txnType === "CREDIT") return "Customer Receipt";
  return "Miscellaneous Expenses";
}

async function loadMappingRules(clientId, db) {
  if (!db || !clientId) return [];

  if (typeof db.getClientMappingRules === "function") {
    return db.getClientMappingRules(clientId, 20);
  }

  if (typeof db.prepare === "function") {
    try {
      return db
        .prepare(
          `SELECT pattern, category, ledger
           FROM mapping_rules
           WHERE client_id = ? AND COALESCE(active, 1) = 1
           ORDER BY COALESCE(confidence_score, 0) DESC
           LIMIT 20`
        )
        .all(clientId);
    } catch (error) {
      return [];
    }
  }

  return [];
}

async function classifyTransaction(rawNarration, amount, txnType, date, clientId, db, userInstruction = "") {
  const normalised = normaliseNarration(rawNarration, amount, txnType);
  const userMappingRules = await loadMappingRules(clientId, db);
  const userPrompt = buildUserPrompt(normalised, userMappingRules, userInstruction);

  let raw = "";
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = (response.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
  } catch (error) {
    return {
      category: "Miscellaneous Expense",
      ledger: "Miscellaneous",
      voucher_type: txnType === "CREDIT" ? "Receipt" : "Payment",
      confidence: 0,
      flags: ["api_error"],
      reasoning: `Classification API error: ${error.message}`,
      status: "flagged",
      requiresReview: true,
      normalised,
      date,
    };
  }

  let parsed;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch (error) {
    console.error("Classification JSON parse error:", raw);
    return {
      category: "Miscellaneous Expense",
      ledger: "Miscellaneous",
      voucher_type: txnType === "CREDIT" ? "Receipt" : "Payment",
      confidence: 0.1,
      flags: ["parse_error"],
      reasoning: "Failed to parse AI response",
      status: "flagged",
      requiresReview: true,
      normalised,
      date,
    };
  }

  const confidence = clampConfidence(parsed.confidence);
  let status = "flagged";
  if (confidence >= 0.85) {
    status = "auto_mapped";
  } else if (confidence >= 0.6) {
    status = "suggested";
  }

  return {
    reasoning: String(parsed.reasoning || "").trim(),
    category: String(parsed.category || "Miscellaneous Expense").trim(),
    ledger: String(parsed.ledger || deriveLedgerName(parsed.category, normalised, txnType)).trim(),
    voucher_type: String(parsed.voucher_type || (txnType === "CREDIT" ? "Receipt" : "Payment")).trim(),
    confidence,
    flags: Array.isArray(parsed.flags) ? parsed.flags.map((item) => String(item)) : [],
    status,
    requiresReview: status !== "auto_mapped",
    normalised,
    date,
  };
}

async function classifyBatch(rows, clientId, db, userInstruction = "") {
  const entries = Array.isArray(rows) ? rows : [];
  const results = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((row) =>
        classifyTransaction(row.narration, row.amount, row.txnType, row.date, clientId, db, userInstruction).catch((error) => ({
          category: "Miscellaneous Expense",
          ledger: "Miscellaneous",
          voucher_type: row.txnType === "CREDIT" ? "Receipt" : "Payment",
          confidence: 0,
          flags: ["api_error"],
          reasoning: `Classification failed: ${error.message}`,
          status: "flagged",
          requiresReview: true,
          normalised: normaliseNarration(row.narration, row.amount, row.txnType),
          date: row.date,
        }))
      )
    );
    results.push(...batchResults);
  }

  return results;
}

module.exports = { classifyTransaction, classifyBatch, SYSTEM_PROMPT, buildUserPrompt };

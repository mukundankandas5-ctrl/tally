import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Home,
  Landmark,
  LogOut,
  Menu,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { List } from "react-window";
import * as XLSX from "xlsx";
import {
  analyzeRecommendations,
  completeDocumentRequest,
  correctTransaction,
  createClient,
  createPairingCode,
  createDocumentRequest,
  downloadRecommendationXml,
  fetchActivity,
  fetchClients,
  fetchDocumentRequests,
  fetchLedgers,
  fetchSyncHistory,
  fetchTallyStatus,
  learnBankStatement,
  loginUser,
  pushBankStatementToTally,
  pushInvoiceToTally,
  pushXmlToTally,
  reconcileGst,
  requestPasswordReset,
  resetPassword,
  restoreAuthUser,
  reviseBankStatement,
  reviseInvoice,
  reviseRecommendations,
  signupUser,
  testTallyConnection,
  uploadBankStatementsBulk,
  uploadBankStatement,
  uploadInvoice,
  logoutUser,
} from "./utils/api";
import { isSupabaseEnabled } from "./utils/authClient";
import { formatCurrency, formatDate, formatNumber } from "./utils/formatters";
import { EmptyState } from "./components/EmptyState";
import { OnboardingWizard } from "./components/OnboardingWizard";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const ROW_HEIGHT = 52;

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "clients", label: "Clients", icon: Users },
  { id: "bank", label: "Bank Statement", icon: Landmark },
  { id: "invoice", label: "Invoice Processor", icon: Receipt },
  { id: "recommendations", label: "Speedy Recommendations", icon: Sparkles },
  { id: "gst", label: "GST Reconciliation", icon: ShieldCheck },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

const STATUS_CONFIG = {
  auto_mapped: { label: "Auto-mapped", style: "bg-[#DCFCE7] text-[#166534]", workflowStatus: "resolved" },
  suggested: { label: "Review", style: "bg-[#FEF3C7] text-[#92400E]", workflowStatus: "pending" },
  flagged: { label: "Needs input", style: "bg-[#FEE2E2] text-[#991B1B]", workflowStatus: "pending" },
  confirmed: { label: "Confirmed", style: "bg-[#DBEAFE] text-[#1E40AF]", workflowStatus: "resolved" },
  resolved: { label: "Resolved", style: "bg-[#DCFCE7] text-[#16A34A]", workflowStatus: "resolved" },
  pending: { label: "Pending", style: "bg-[#FEF3C7] text-[#D97706]", workflowStatus: "pending" },
  failed: { label: "Failed", style: "bg-[#FEE2E2] text-[#DC2626]", workflowStatus: "failed" },
};

const voucherOptions = ["Payment", "Receipt", "Contra", "Purchase", "Journal"];
const bankOptions = ["Kotak Mahindra Bank", "HDFC Bank", "ICICI Bank", "Axis Bank", "SBI", "Union Bank of India", "Yes Bank", "IDFC First Bank"];
const ALL_CATEGORIES = [
  "Sales / Revenue",
  "Service Income",
  "Interest Received",
  "Rental Income",
  "Commission Received",
  "Refund Received",
  "Loan Disbursement Received",
  "Salary & Wages",
  "Rent Paid",
  "Electricity & Utilities",
  "Office Supplies",
  "Travel & Conveyance",
  "Meals & Entertainment",
  "Professional Fees",
  "Software & Subscriptions",
  "Advertising & Marketing",
  "Repairs & Maintenance",
  "Insurance Premium",
  "Telephone & Internet",
  "Printing & Stationery",
  "Miscellaneous Expense",
  "GST Payment",
  "TDS Deducted",
  "TDS Received",
  "Advance Tax",
  "Professional Tax",
  "PF Contribution",
  "ESI Contribution",
  "Bank Charges & Fees",
  "Loan EMI Repayment",
  "Interest on Loan",
  "FD / Investment",
  "FD Maturity / Investment Return",
  "Inter-bank Transfer",
  "Vendor Payment",
  "Customer Receipt",
  "Director / Partner Drawing",
  "Capital Contribution",
  "Petty Cash",
];

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

function deriveLedgerFromCategory(category, particulars = "", txnType = "") {
  if (CATEGORY_LEDGER_FALLBACKS[category]) return CATEGORY_LEDGER_FALLBACKS[category];
  const haystack = String(particulars || "").toLowerCase();
  if (/swiggy|zomato/.test(haystack)) return "Office Expenses";
  if (/amazon|flipkart|myntra|meesho/.test(haystack)) return "Office Expenses";
  if (/irctc|makemytrip|cleartrip|uber|ola|rapido/.test(haystack)) return "Travelling Expenses";
  if (/airtel|jio|bsnl|vodafone|vi/.test(haystack)) return "Internet Charges";
  if (/bescom|msedcl|tneb|bses|kseb/.test(haystack)) return "Electricity";
  if (/lic|sbi life|hdfc life|icici pru|bajaj/.test(haystack)) return "Insurance";
  if (/gstn|cpin|gst payment/.test(haystack)) return "GST Payment";
  if (/salary|payroll|wages/.test(haystack)) return "Salary";
  if (/emi|loan/.test(haystack)) return "Loan Account";
  if (txnType === "CREDIT") return "Customer Receipt";
  return "Miscellaneous Expenses";
}

function markAsConfirmedIfClassified(row) {
  return row.classificationStatus ? "confirmed" : row.classificationStatus;
}

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizeConfidenceScore(confidence, confidenceLabel) {
  const numeric = Number(confidence);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(1, numeric));
  if (confidenceLabel === "high") return 0.9;
  if (confidenceLabel === "low") return 0.45;
  return 0.7;
}

function confidenceLabelFromScore(score) {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function normalizeWorkflowStatus(classificationStatus, confidenceLabel, needsReview) {
  if (classificationStatus && STATUS_CONFIG[classificationStatus]) {
    return STATUS_CONFIG[classificationStatus].workflowStatus;
  }
  if (needsReview || confidenceLabel === "low") return "pending";
  return "resolved";
}

function normalizeBankRows(statement) {
  return (statement.transactions || []).map((row) => ({
    id: row.id,
    sourceId: row.id,
    classificationStatus: row.status || "",
    status: normalizeWorkflowStatus(row.status, row.confidenceLabel || row.confidence, row.needsReview),
    confidenceScore: normalizeConfidenceScore(row.confidence, row.confidenceLabel),
    confidence: row.confidenceLabel || (typeof row.confidence === "string" ? row.confidence : confidenceLabelFromScore(normalizeConfidenceScore(row.confidence, row.confidenceLabel))),
    date: row.date,
    particulars: row.narration,
    amount: Number(row.debit || row.credit || 0),
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    category: row.category || row.ledgerHead || "Miscellaneous Expense",
    autoLedger: deriveLedgerFromCategory(row.category || row.ledgerHead, row.particulars || row.narration, row.txnType),
    ledger: row.ledgerHead || row.ledger || deriveLedgerFromCategory(row.category || row.ledgerHead, row.particulars || row.narration, row.txnType),
    voucherType: row.voucherType || "Payment",
    reasoning: row.reasoning || "",
    normalised: row.normalised || null,
    clientId: row.clientId || statement?.tallyConfig?.clientId || "",
    upiVpa: row.upiVpa || row.normalised?.upiVpa || "",
    original: row,
  }));
}

function normalizeRecommendationRows(payload) {
  return (payload.mappings || []).map((row) => ({
    id: row.id,
    sourceId: row.id,
    status: row.accepted ? "resolved" : row.suggestion?.confidence === "low" ? "pending" : "pending",
    confidence: row.suggestion?.confidence || "medium",
    date: row.date,
    particulars: row.description,
    amount: Number(row.debit || row.credit || 0),
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    ledger: row.suggestion?.ledgerHead || row.currentLedger || "Suspense",
    voucherType: row.suggestion?.voucherType || "Payment",
    original: row,
  }));
}

function normalizeInvoiceRows(invoice) {
  return (invoice.lineItems || []).map((item) => ({
    id: item.id,
    sourceId: item.id,
    status: invoice.confidence === "low" ? "pending" : "resolved",
    confidence: invoice.confidence || "medium",
    date: invoice.invoiceDate,
    particulars: item.description,
    amount: Number(item.amount || 0),
    debit: Number(item.amount || 0),
    credit: 0,
    ledger: invoice.tallyConfig?.purchaseLedgerName || "Purchase A/c",
    voucherType: "Purchase",
    original: item,
  }));
}

function countTotals(rows) {
  return rows.reduce(
    (acc, row) => ({
      debit: acc.debit + Number(row.debit || 0),
      credit: acc.credit + Number(row.credit || 0),
    }),
    { debit: 0, credit: 0 }
  );
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}


function createEmptyBankStatement() {
  return {
    confidence: "medium",
    summary: { periodStart: "", periodEnd: "", totalDebits: 0, totalCredits: 0, transactionCount: 0, reviewCount: 0 },
    transactions: [],
    reviewNotes: [],
    tallyConfig: { companyName: "", bankLedgerName: "Bank Account" },
    learningSummary: { learnedRuleCount: 0, recentInstructions: [] },
  };
}

function createEmptyInvoice() {
  return {
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
    lineItems: [],
    reviewNotes: [],
    tallyConfig: {
      companyName: "",
      purchaseLedgerName: "Purchase A/c",
      cgstLedgerName: "Input CGST",
      sgstLedgerName: "Input SGST",
      igstLedgerName: "Input IGST",
    },
  };
}

function createGroupingSignature(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(upi|imps|neft|rtgs|ach|dr|cr|txn|transfer|ref|bank|kotak|mahindra|ltd|pvt|private|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 2 && !/^\d+$/.test(token))
    .slice(0, 4)
    .join(" ");
}

function buildSpeedyGroups(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const signature = createGroupingSignature(row.particulars) || row.particulars.toLowerCase().slice(0, 20) || row.id;
    const key = `${signature}__${row.voucherType}`;
    const existing = groups.get(key) || {
      id: key,
      signature,
      title: signature || "Grouped Entries",
      voucherType: row.voucherType,
      ledger: row.ledger,
      rowIds: [],
      count: 0,
      total: 0,
      unresolvedCount: 0,
      examples: [],
    };

    existing.rowIds.push(row.id);
    existing.count += 1;
    existing.total += Number(row.amount || 0);
    existing.unresolvedCount += row.status !== "resolved" ? 1 : 0;
    if (existing.examples.length < 2 && !existing.examples.includes(row.particulars)) {
      existing.examples.push(row.particulars);
    }
    groups.set(key, existing);
  });

  return Array.from(groups.values())
    .filter((group) => group.count > 1)
    .sort((left, right) => right.count - left.count || right.total - left.total);
}

function getVisibleRows(rows, filters) {
  return rows.filter((row) => {
    const query = filters.search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      row.particulars.toLowerCase().includes(query) ||
      String(row.category || "").toLowerCase().includes(query) ||
      row.ledger.toLowerCase().includes(query) ||
      row.voucherType.toLowerCase().includes(query);
    const matchesStatus = filters.status === "all" || row.status === filters.status;
    const matchesVoucher = filters.voucherType === "all" || row.voucherType === filters.voucherType;
    return matchesQuery && matchesStatus && matchesVoucher;
  });
}

function AppIconButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border border-white/60 bg-white/50 text-[#6B7280] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:bg-white/70 hover:text-[#111827]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Button({ variant = "primary", className = "", children, ...props }) {
  const variants = {
    primary:
      "bg-[linear-gradient(135deg,rgba(124,58,237,0.96)_0%,rgba(79,70,229,0.94)_100%)] text-white border border-white/30 shadow-[0_16px_40px_rgba(124,58,237,0.28)]",
    ghost:
      "bg-white/50 text-[#374151] border border-white/60 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:bg-white/70",
    outlinePurple:
      "bg-white/45 text-[#7C3AED] border border-[#C4B5FD]/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(124,58,237,0.08)] hover:bg-white/75",
    danger:
      "bg-white/50 text-[#DC2626] border border-[#FCA5A5]/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(220,38,38,0.08)] hover:bg-white/75",
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-xl",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({ status, confidence }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.flagged;
  const confidenceLabel = typeof confidence === "string" ? confidence : confidenceLabelFromScore(Number(confidence || 0));
  const dotClass =
    confidenceLabel === "high" ? "bg-[#16A34A]" : confidenceLabel === "low" ? "bg-[#DC2626]" : "bg-[#D97706]";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", config.style)}>
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      {config.label}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-xl border bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.12)]",
            toast.tone === "success" && "border-[#BBF7D0] border-l-4 border-l-[#16A34A]",
            toast.tone === "error" && "border-[#FECACA] border-l-4 border-l-[#DC2626]",
            toast.tone === "info" && "border-[#E5E7EB]"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-[#111827]">{toast.message}</div>
            <button type="button" className="text-[#9CA3AF]" onClick={() => onDismiss(toast.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// StepIndicator Component
function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex w-full items-center mb-6">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = currentStep === stepNum;
        const isComplete = currentStep > stepNum;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className={cn("flex flex-col items-center", isComplete || isActive ? "text-[#7C3AED]" : "text-[#9CA3AF]")}>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2", isComplete ? "bg-[#7C3AED] border-[#7C3AED] text-white" : isActive ? "border-[#7C3AED] bg-white text-[#7C3AED]" : "border-[#E5E7EB] bg-white text-[#9CA3AF]")}>
                {isComplete ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <div className="mt-2 text-xs font-medium whitespace-nowrap px-2">{step}</div>
            </div>
            {index < steps.length - 1 && (
              <div className={cn("h-0.5 flex-1 -mt-5 mx-2", isComplete ? "bg-[#7C3AED]" : "bg-[#E5E7EB]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DropzoneCard({ title, helper, accept, multiple, onSelect }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-8 text-center hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition">
      <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#E5E7EB] text-[#6B7280]">
        <FileSpreadsheet className="h-6 w-6" />
      </div>
      <div className="mt-4 text-base font-medium text-[#111827]">{title}</div>
      <div className="mt-2 text-sm text-[#6B7280]">{helper}</div>
      <div className="mt-6 flex justify-center">
        <label className="cursor-pointer rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
          Browse {multiple ? "Files" : "File"}
          <input
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={(event) => {
              if (event.target.files.length) {
                multiple ? onSelect(Array.from(event.target.files)) : onSelect(event.target.files[0]);
              }
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function FileDropCard({ title, helper, accept, onSelect }) {
  return <DropzoneCard title={title} helper={helper} accept={accept} onSelect={onSelect} />;
}

function BulkFileDropCard({ title, helper, accept, onSelect }) {
  return <DropzoneCard title={title} helper={helper} accept={accept} multiple onSelect={onSelect} />;
}

function TallyStatusBadge({ onConnectClick, onStatus }) {
  const [status, setStatus] = useState({
    connectorConnected: false,
    tallyConnected: false,
    tallyCompany: "",
  });

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const payload = await fetchTallyStatus();
        if (!active) return;
        setStatus(payload);
        onStatus?.(payload);
      } catch (error) {
        if (!active) return;
        const fallback = { connectorConnected: false, tallyConnected: false, tallyCompany: "" };
        setStatus(fallback);
        onStatus?.(fallback);
      }
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const dot = status.tallyConnected ? "bg-[#16A34A]" : status.connectorConnected ? "bg-[#D97706]" : "bg-[#9CA3AF]";
  const label = status.tallyConnected
    ? `● Connected`
    : status.connectorConnected
      ? "● Connected (Wait for Tally)"
      : "○ Not connected";

  return (
    <button 
      type="button" 
      onClick={!status.connectorConnected ? onConnectClick : undefined} 
      className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition", status.tallyConnected ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : status.connectorConnected ? "border-[#FEF3C7] bg-[#FFFBEB] text-[#B45309]" : "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]")}
    >
      <span>{label}</span>
      {!status.connectorConnected && <span className="ml-1 text-[#7C3AED]">Connect</span>}
    </button>
  );
}

function PairingModal({ open, code, onClose, connected }) {
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connected && open) {
      onClose();
    }
  }, [connected, open, onClose]);

  useEffect(() => {
    if (open && code) {
      navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => {});
      setTimeLeft(300);
      const timer = setInterval(() => {
        setTimeLeft(t => (t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [open, code]);

  if (!open) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#111827]/40 p-4">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[#111827]">Connect Tally</div>
        <p className="mt-3 text-sm text-[#6B7280]">
          Open the Tally AI Connector app on your Windows PC and enter this code.
        </p>
        <div className="mt-6 rounded-xl border border-[#E9D5FF] bg-[#F5F3FF] px-6 py-8 text-center relative">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#7C3AED]">Pairing code</div>
          <div className="mt-2 text-5xl font-semibold tracking-[0.28em] text-[#111827] select-all">{code || "------"}</div>
          {copied && <div className="mt-3 text-sm font-semibold text-[#16A34A]">✓ Copied to clipboard</div>}
          <div className="absolute bottom-3 right-4 text-xs font-medium text-[#6B7280]">
            Valid for {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}>
            Copy Code
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, body, confirmText, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#111827]/40 p-4">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[#111827]">{title}</div>
        <div className="mt-3 text-sm leading-6 text-[#6B7280]">{body}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SearchField({ value, onChange }) {
  return (
    <div className="relative min-w-[240px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search transactions..."
        className="h-10 w-full rounded-lg border border-[#D1D5DB] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none ring-0 placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
      />
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#374151]">
      <span className="text-[#6B7280]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
    </label>
  );
}

function EditableCellSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-2xl border border-white/60 bg-white/60 px-3 text-sm text-[#111827] shadow-[0_8px_24px_rgba(15,23,42,0.08)] outline-none backdrop-blur-xl transition hover:border-[#C4B5FD] hover:bg-white/75 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
    >
      <option value="">Select...</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function EditableAmountInput({ value, onChange, tone }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn(
        "h-9 w-full rounded-2xl border border-white/60 bg-white/60 px-3 text-right text-sm shadow-[0_8px_24px_rgba(15,23,42,0.08)] outline-none backdrop-blur-xl transition hover:border-[#C4B5FD] hover:bg-white/75 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]",
        tone === "debit" ? "text-[#DC2626]" : "text-[#16A34A]"
      )}
    />
  );
}

function ReasoningTooltip({ reasoning, confidenceScore }) {
  if (!reasoning) return null;
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/60 text-[11px] font-semibold text-[#6B7280] backdrop-blur-xl shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
      title={`${Math.round(Number(confidenceScore || 0) * 100)}% confident\n${reasoning}`}
    >
      i
    </span>
  );
}

function CategoryCell({ row, onCategorySave }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(row.category || "Miscellaneous Expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(row.category || "Miscellaneous Expense");
  }, [row.category, row.id]);

  async function handleSave() {
    if (!onCategorySave) return;
    try {
      setSaving(true);
      await onCategorySave(row, selected);
      setEditing(false);
    } catch (error) {
      // keep the editor open so the user can retry or change selection
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/55 p-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="h-9 min-w-[152px] rounded-2xl border border-white/70 bg-white/70 px-3 text-xs text-[#111827] outline-none backdrop-blur-xl focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
        >
          {ALL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl border border-[#C4B5FD]/70 bg-white/70 px-3 py-2 text-xs font-semibold text-[#6D28D9] backdrop-blur-xl transition hover:bg-white/90 disabled:opacity-60"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(row.category || "Miscellaneous Expense");
            setEditing(false);
          }}
          className="rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-xs text-[#4B5563] backdrop-blur-xl transition hover:bg-white/80"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          setEditing(true);
        }
      }}
      title={`Confidence: ${Math.round(Number(row.confidenceScore || 0) * 100)}% — click to correct`}
      className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs text-[#111827] shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:border-[#C4B5FD] hover:bg-white/80"
    >
      <span className="truncate">{row.category || "Miscellaneous Expense"}</span>
      {Number(row.confidenceScore || 0) < 0.85 ? (
        <span className="text-[11px] text-[#6B7280]">✎</span>
      ) : null}
    </div>
  );
}

function SignInPage({ mode, setMode, form, setForm, error, busy, message, onSubmit, showPassword, setShowPassword, supabaseEnabled }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#1E1B4B_0%,#312E81_52%,#7C3AED_100%)] px-4 py-10">
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-between bg-[#1E1B4B] p-8 text-white">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
              <ShieldCheck className="h-4 w-4" />
              Secure Workspace Access
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">
              {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in to Tally AI Workspace"}
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/75">
              {mode === "signup"
                ? "Create a user account to access bank processing, invoice review, GST reconciliation, and Tally sync actions."
                : mode === "forgot"
                  ? supabaseEnabled
                    ? "Request a password reset email and continue back into the accounting workspace."
                    : "Reset your password and continue back into the accounting workspace."
                  : "Sign in with your email and password to continue into the accounting workspace."}
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Workspace flow</div>
            <div className="mt-3 space-y-3 text-sm text-white/85">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">1. Sign up with your name, email, and password</div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">2. Sign in to review bank statements and invoices</div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">3. Use forgot password if you need to reset your access</div>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <div className="mx-auto max-w-[420px]">
            <div className="text-2xl font-semibold text-[#111827]">
              {mode === "signup" ? "New account" : mode === "forgot" ? "Password recovery" : "Welcome back"}
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              {mode === "signup"
                ? "Create an account to access the dashboard."
                : mode === "forgot"
                  ? supabaseEnabled
                    ? "Enter your email and we will send a password reset link."
                    : "Request a reset code, then use it to set a new password."
                  : "Enter your email and password to access the dashboard."}
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              {mode === "signup" ? (
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-[#374151]">Name</div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
                    placeholder="Your full name"
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="mb-2 text-sm font-medium text-[#374151]">Email</div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
                  placeholder="name@example.com"
                />
              </label>

              {mode !== "forgot" || !supabaseEnabled ? (
              <label className="block">
                <div className="mb-2 text-sm font-medium text-[#374151]">
                  {mode === "forgot" ? "New Password" : "Password"}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={mode === "forgot" ? form.newPassword : form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [mode === "forgot" ? "newPassword" : "password"]: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
                    placeholder={mode === "forgot" ? "Choose a new password" : "Enter password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm font-medium text-[#4B5563] transition hover:bg-[#F9FAFB]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              ) : null}

              {mode === "forgot" && !supabaseEnabled ? (
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-[#374151]">Reset Code</div>
                  <input
                    type="text"
                    value={form.resetToken}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        resetToken: event.target.value.toUpperCase(),
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm uppercase tracking-[0.16em] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
                    placeholder="Enter reset code"
                  />
                  <div className="mt-2 text-xs text-[#6B7280]">
                    Leave this empty the first time to generate a reset code for the email above.
                  </div>
                </label>
              ) : null}

              {message ? <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">{message}</div> : null}
              {error ? <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</div> : null}

              <Button type="submit" variant="primary" className="h-11 w-full justify-center" disabled={busy}>
                {busy
                  ? mode === "signup"
                    ? "Creating account..."
                    : mode === "forgot"
                      ? supabaseEnabled
                        ? "Sending reset email..."
                        : form.resetToken
                          ? "Updating password..."
                          : "Generating reset code..."
                      : "Signing in..."
                  : mode === "signup"
                    ? "Sign Up"
                    : mode === "forgot"
                      ? supabaseEnabled
                        ? "Send Reset Email"
                        : form.resetToken
                          ? "Update Password"
                          : "Generate Reset Code"
                      : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              {mode !== "signin" ? (
                <button type="button" className="font-medium text-[#7C3AED]" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              ) : null}
              {mode !== "signup" ? (
                <button type="button" className="font-medium text-[#7C3AED]" onClick={() => setMode("signup")}>
                  Create account
                </button>
              ) : null}
              {mode !== "forgot" ? (
                <button type="button" className="font-medium text-[#7C3AED]" onClick={() => setMode("forgot")}>
                  Forgot password
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TableRow({
  row,
  isSelected,
  flash,
  onToggle,
  onFieldChange,
  ledgerOptions,
  rowType,
  onCorrectTransaction,
}) {
  const workflowStatus = row.status || "pending";
  const amountEditingEnabled = isSelected || workflowStatus !== "resolved";
  const isBankRow = rowType === "bank";
  const displayLedger = row.ledger || row.autoLedger || deriveLedgerFromCategory(row.category || "", row.particulars || row.normalised?.cleaned || "", row.txnType || "");
  const gridTemplateColumns = isBankRow
    ? "34px 96px 84px minmax(160px,1fr) 92px 92px 92px 132px 136px 124px"
    : "40px 100px 100px minmax(280px,1fr) 120px 120px 120px 200px 150px";

  return (
    <div
      className={cn(
        "grid h-[52px] items-center border-b border-white/60 bg-white/50 text-sm transition hover:bg-white/70",
        isSelected && "bg-white/80",
        flash && "row-flash"
      )}
      style={{ gridTemplateColumns }}
    >
      <div className="flex items-center justify-center">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.id)} className="h-4 w-4 accent-[#7C3AED]" />
      </div>
      <div className="flex items-center gap-2 px-3">
        <Badge status={row.classificationStatus || row.status} confidence={row.confidenceScore || row.confidence} />
        {isBankRow ? <ReasoningTooltip reasoning={row.reasoning} confidenceScore={row.confidenceScore} /> : null}
      </div>
      <div className="px-3 text-[#4B5563]">{formatDate(row.date)}</div>
      <div className="truncate px-3 text-[#111827]">{row.particulars}</div>
      <div className="px-3 text-right font-medium text-[#111827]">{formatCurrency(row.amount)}</div>
      <div className="px-3">
        {amountEditingEnabled ? (
          <EditableAmountInput value={row.debit} tone="debit" onChange={(value) => onFieldChange(row.id, "debit", value)} />
        ) : (
          <div className="px-2 text-right text-sm font-medium text-[#DC2626]">{formatCurrency(row.debit)}</div>
        )}
      </div>
      <div className="px-3">
        {amountEditingEnabled ? (
          <EditableAmountInput value={row.credit} tone="credit" onChange={(value) => onFieldChange(row.id, "credit", value)} />
        ) : (
          <div className="px-2 text-right text-sm font-medium text-[#16A34A]">{formatCurrency(row.credit)}</div>
        )}
      </div>
      {isBankRow ? (
        <>
          <div className="px-3">
            <CategoryCell row={row} onCategorySave={onCorrectTransaction} />
          </div>
          <div className="px-3">
            <EditableCellSelect value={displayLedger} onChange={(value) => onFieldChange(row.id, "ledger", value)} options={ledgerOptions} />
          </div>
          <div className="px-3">
            <EditableCellSelect
              value={row.voucherType}
              onChange={(value) => onFieldChange(row.id, "voucherType", value)}
              options={voucherOptions}
            />
          </div>
        </>
      ) : (
        <>
          <div className="px-3">
            <EditableCellSelect value={displayLedger} onChange={(value) => onFieldChange(row.id, "ledger", value)} options={ledgerOptions} />
          </div>
          <div className="px-3">
            <EditableCellSelect
              value={row.voucherType}
              onChange={(value) => onFieldChange(row.id, "voucherType", value)}
              options={voucherOptions}
            />
          </div>
        </>
      )}
    </div>
  );
}

function VirtualTableRow({ index, style, rowProps }) {
  const row = rowProps.visibleRows[index];
  return (
    <div style={style}>
      <TableRow
        row={row}
        isSelected={rowProps.selectedRowIds.includes(row.id)}
        flash={rowProps.flashRowIds.includes(row.id)}
        onToggle={rowProps.onToggleRow}
        onFieldChange={rowProps.onFieldChange}
        ledgerOptions={rowProps.ledgerOptions}
        rowType={rowProps.rowType}
        onCorrectTransaction={rowProps.onCorrectTransaction}
      />
    </div>
  );
}

function EntryTable({
  title,
  subtitle,
  rows,
  rowType = "generic",
  ledgerOptions,
  filters,
  onFiltersChange,
  selectedRowIds,
  onToggleRow,
  onToggleAll,
  onFieldChange,
  onApproveSelected,
  onMapSuspense,
  onExport,
  onDownloadXml,
  onSendToTally,
  recommendationCards,
  onApproveRecommendation,
  aiHint,
  onAiHintChange,
  onApplyAiHint,
  flashRowIds,
  onCorrectTransaction,
}) {
  const visibleRows = useMemo(() => getVisibleRows(rows, filters), [rows, filters]);
  const visibleSelectedCount = visibleRows.filter((row) => selectedRowIds.includes(row.id)).length;
  const totals = countTotals(visibleRows);
  const unresolvedCount = visibleRows.filter((row) => row.status !== "resolved").length;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRowIds.includes(row.id));
  const [bulkLedger, setBulkLedger] = useState(ledgerOptions[0] || "Suspense");
  const [showSuspensePopover, setShowSuspensePopover] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isBankRowType = rowType === "bank";
  const tableHeight = Math.min(visibleRows.length, 8) * ROW_HEIGHT + 44;
  const gridTemplateColumns = isBankRowType
    ? "34px 96px 84px minmax(160px,1fr) 92px 92px 92px 132px 136px 124px"
    : "40px 100px 100px minmax(280px,1fr) 120px 120px 120px 200px 150px";

  const renderHeader = (
    <div className="grid h-11 items-center bg-white/55 text-xs uppercase tracking-[0.08em] text-[#6B7280] backdrop-blur-xl" style={{ gridTemplateColumns }}>
      <div className="flex items-center justify-center">
        <input type="checkbox" checked={allVisibleSelected} onChange={onToggleAll} className="h-4 w-4 accent-[#7C3AED]" />
      </div>
      <div className="px-3 font-medium">Status</div>
      <div className="px-3 font-medium">Date</div>
      <div className="px-3 font-medium">Particulars</div>
      <div className="px-3 text-right font-medium">Amount</div>
      <div className="px-3 text-right font-medium">Debit</div>
      <div className="px-3 text-right font-medium">Credit</div>
      {isBankRowType ? (
        <>
          <div className="px-3 font-medium">Category</div>
          <div className="px-3 font-medium">Ledger</div>
          <div className="px-3 font-medium">Voucher Type</div>
        </>
      ) : (
        <>
          <div className="px-3 font-medium">Ledger</div>
          <div className="px-3 font-medium">Voucher Type</div>
        </>
      )}
    </div>
  );

  return (
    <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
      <div className="border-b border-white/50 px-5 py-4">
        <div className="text-lg font-semibold text-[#111827]">{title}</div>
        <div className="mt-1 text-sm text-[#6B7280]">{subtitle}</div>
      </div>

      <div className="px-5 py-4">
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {recommendationCards.length ? (
            recommendationCards.map((card) => (
              <div key={card.id} className="fade-in min-w-[280px] rounded-3xl border border-white/70 bg-white/55 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="border-l-[3px] border-[#7C3AED] pl-3">
                  <div className="line-clamp-2 text-sm font-semibold text-[#111827]">{card.particulars}</div>
                  <div className="mt-2 text-sm text-[#7C3AED]">{card.ledger}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => onApproveRecommendation(card.id)}>
                    Approve
                  </Button>
                  <Button variant="ghost" className="px-3 py-1.5 text-xs">
                    Skip
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/70 bg-white/40 px-4 py-6 text-sm text-[#6B7280] backdrop-blur-xl">
              No recommendation cards for the current selection.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/45 p-4 backdrop-blur-xl">
          <div className="text-sm font-medium text-[#111827]">Adjustment instructions</div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <textarea
              value={aiHint}
              onChange={(event) => onAiHintChange(event.target.value)}
              placeholder="Example: Treat UPI transactions containing family names as remittance instead of salary or expense."
              className="min-h-[72px] flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
            />
            <Button variant="outlinePurple" className="h-fit" onClick={onApplyAiHint}>
              <Sparkles className="h-4 w-4" />
              Apply AI Hint
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SearchField value={filters.search} onChange={(value) => onFiltersChange({ ...filters, search: value })} />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => onFiltersChange({ ...filters, status: value })}
              options={[
                { value: "all", label: "All" },
                { value: "resolved", label: "Resolved" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
              ]}
            />
            <FilterSelect
              label="Voucher"
              value={filters.voucherType}
              onChange={(value) => onFiltersChange({ ...filters, voucherType: value })}
              options={[
                { value: "all", label: "All" },
                ...voucherOptions.map((option) => ({ value: option, label: option })),
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onExport}>
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
            {onDownloadXml && (
              <Button variant="ghost" onClick={onDownloadXml}>
                <Download className="h-4 w-4" />
                Download Tally XML
              </Button>
            )}
            <Button variant="primary" onClick={() => setShowConfirm(true)}>
              <Send className="h-4 w-4" />
              Send to Tally
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-white/50" />

        {visibleSelectedCount > 0 ? (
          <div className="sticky top-[68px] z-10 mt-4 flex items-center justify-between rounded-lg bg-[#1E1B4B] px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(30,27,75,0.22)]">
            <div>{visibleSelectedCount} rows selected</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-white">
                <span>Apply ledger to all selected</span>
                <select
                  value={bulkLedger}
                  onChange={(event) => setBulkLedger(event.target.value)}
                  className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-white outline-none"
                >
                  {ledgerOptions.map((option) => (
                    <option key={option} value={option} className="text-[#111827]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" onClick={() => onApproveSelected(bulkLedger)}>
                Update
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[28px] border border-white/70 bg-white/35 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <div className={cn(isBankRowType ? "min-w-[1120px]" : "min-w-[1070px]")}>
              {renderHeader}
              {visibleRows.length > 100 ? (
                <List
                  rowComponent={VirtualTableRow}
                  rowCount={visibleRows.length}
                  rowHeight={ROW_HEIGHT}
                  rowProps={{
                    visibleRows,
                    selectedRowIds,
                    onToggleRow,
                    onFieldChange,
                    ledgerOptions,
                    flashRowIds,
                    rowType,
                    onCorrectTransaction,
                  }}
                  style={{ height: Math.min(visibleRows.length, 8) * ROW_HEIGHT }}
                >
                </List>
              ) : (
                <div>
                  {visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      row={row}
                      isSelected={selectedRowIds.includes(row.id)}
                      flash={flashRowIds.includes(row.id)}
                      onToggle={onToggleRow}
                      onFieldChange={onFieldChange}
                      ledgerOptions={ledgerOptions}
                      rowType={rowType}
                      onCorrectTransaction={onCorrectTransaction}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 mt-0 flex flex-col gap-3 border-t border-white/50 bg-white/55 px-5 py-4 backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#4B5563]">
            <span>Total rows: {visibleRows.length}</span>
            <span>Selected: {visibleSelectedCount}</span>
            <span className="text-[#DC2626]">Debit: {formatCurrency(totals.debit)}</span>
            <span className="text-[#16A34A]">Credit: {formatCurrency(totals.credit)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={visibleSelectedCount === 0} onClick={() => onApproveSelected("resolved")}>
              Approve Selected
            </Button>
            <div className="relative">
              <Button variant="ghost" onClick={() => setShowSuspensePopover((current) => !current)}>
                Map to Suspense
              </Button>
              {showSuspensePopover ? (
                <div className="absolute bottom-full right-0 mb-2 w-[280px] rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                  <div className="text-sm text-[#111827]">Map {unresolvedCount} unresolved entries to Suspense ledger?</div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button type="button" className="text-sm text-[#6B7280]" onClick={() => setShowSuspensePopover(false)}>
                      Cancel
                    </button>
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        onMapSuspense();
                        setShowSuspensePopover(false);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Push to Tally"
        body={`You are about to push ${visibleSelectedCount || visibleRows.filter((row) => row.status === "resolved").length} entries to TallyPrime. Unresolved entries will be skipped.`}
        confirmText="Confirm & Push"
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onSendToTally(visibleRows);
        }}
      />
    </div>
  );
}

function SpeedyGroupPanel({ groups, ledgerOptions, onApproveGroup, onMarkGroupUnresolved }) {
  const [drafts, setDrafts] = useState({});

  const getDraft = (group) =>
    drafts[group.id] || {
      ledger: group.ledger,
      voucherType: group.voucherType,
    };

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-6 text-sm text-[#6B7280]">
        Speedy has no repeat-pattern groups right now. Upload a statement or review more rows to build stronger batches.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const draft = getDraft(group);
        return (
          <div key={group.id} className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold capitalize text-[#111827]">{group.title}</div>
                <div className="mt-1 text-xs text-[#6B7280]">
                  {group.count} similar entries • {formatCurrency(group.total)} total • {group.unresolvedCount} unresolved
                </div>
              </div>
              <Badge status={group.unresolvedCount ? "pending" : "resolved"} confidence={group.unresolvedCount ? "medium" : "high"} />
            </div>

            <div className="mt-3 rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]">
              {group.examples.map((example) => (
                <div key={example} className="truncate">
                  {example}
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3">
              <EditableCellSelect
                value={draft.ledger}
                onChange={(value) => setDrafts((current) => ({ ...current, [group.id]: { ...draft, ledger: value } }))}
                options={ledgerOptions}
              />
              <EditableCellSelect
                value={draft.voucherType}
                onChange={(value) => setDrafts((current) => ({ ...current, [group.id]: { ...draft, voucherType: value } }))}
                options={voucherOptions}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => onApproveGroup(group, draft)}>
                Approve Group
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onMarkGroupUnresolved(group)}>
                Mark Unresolved
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const supabaseEnabled = isSupabaseEnabled();
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", newPassword: "", resetToken: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem("tally-ai-session");
      return raw ? JSON.parse(raw).user : null;
    } catch (error) {
      return null;
    }
  });
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bootError, setBootError] = useState("");
  const [busy, setBusy] = useState("");
  const [ledgerHeads, setLedgerHeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [documentRequests, setDocumentRequests] = useState([]);
  const [tallyStatus, setTallyStatus] = useState({ connectorConnected: false, tallyConnected: false, tallyCompany: "" });
  const [pairingCode, setPairingCode] = useState("");
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);

  const [bankStatement, setBankStatement] = useState(createEmptyBankStatement());
  const [bankRows, setBankRows] = useState(normalizeBankRows(createEmptyBankStatement()));
  const [bankFilters, setBankFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [bankSelected, setBankSelected] = useState([]);
  const [bankHint, setBankHint] = useState("");
  const [bulkBankJobs, setBulkBankJobs] = useState([]);
  const [bankProcessingConfig, setBankProcessingConfig] = useState({
    clientId: "",
    companyName: "",
    bankName: "Kotak Mahindra Bank",
    bankLedgerName: "Bank Account",
    intervalStart: "",
    intervalEnd: "",
  });

  const [invoice, setInvoice] = useState(createEmptyInvoice());
  const [invoiceRows, setInvoiceRows] = useState(normalizeInvoiceRows(createEmptyInvoice()));
  const [invoiceFilters, setInvoiceFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [invoiceSelected, setInvoiceSelected] = useState([]);
  const [invoiceHint, setInvoiceHint] = useState("");

  const [recommendations, setRecommendations] = useState({
    confidence: "medium",
    summary: { totalRows: 0, acceptedCount: 0, needsReviewCount: 0 },
    mappings: [],
    learningSummary: { learnedRuleCount: 0, recentInstructions: [] },
    tallyConfig: { companyName: "", bankLedgerName: "Bank Account" },
  });
  const [recommendationRows, setRecommendationRows] = useState([]);
  const [recommendationFilters, setRecommendationFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [recommendationSelected, setRecommendationSelected] = useState([]);
  const [recommendationHint, setRecommendationHint] = useState("");

  const [gstReport, setGstReport] = useState({ summary: { matched: 0, partial: 0, unmatched: 0 }, rows: [] });
  const [clientForm, setClientForm] = useState({ name: "", bankName: "Kotak Mahindra Bank", tallyCompanyName: "" });
  const [documentForm, setDocumentForm] = useState({ clientId: "", title: "", channel: "WhatsApp", dueDate: "", notes: "" });
  const [settingsForm, setSettingsForm] = useState({
    host: "localhost",
    port: "9000",
    companyName: "",
    anthropicApiKey: "",
    showApiKey: false,
    deviceId: "",
  });
  const [testConnectionResult, setTestConnectionResult] = useState("");
  const [flashRowIds, setFlashRowIds] = useState([]);

  const activeClient = clients.find((item) => item.id === bankProcessingConfig.clientId) || clients[0];
  const pageTitle = navigation.find((item) => item.id === activePage)?.label || "Dashboard";
  const ledgerOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...ledgerHeads.map((item) => item.name),
          ...Object.values(CATEGORY_LEDGER_FALLBACKS),
          "Bank Account",
          "Suspense",
          "Suspense A/c",
          "Remittance",
        ])
      ),
    [ledgerHeads]
  );

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    let active = true;
    restoreAuthUser()
      .then((payload) => {
        if (!active || !payload?.user) return;
        setAuthUser(payload.user);
        window.localStorage.setItem("tally-ai-session", JSON.stringify(payload));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetchLedgers(), fetchClients(), fetchTallyStatus(), fetchDocumentRequests(), fetchActivity(), fetchSyncHistory()])
      .then(([ledgerPayload, clientPayload, tallyPayload, requestPayload, activityPayload, syncPayload]) => {
        if (!active) return;
        setLedgerHeads(ledgerPayload.ledgerHeads || []);
        const nextClients = clientPayload.clients || [];
        setClients(nextClients);
        setDocumentRequests(requestPayload.requests || []);
        setActivity(activityPayload || []);
        setSyncHistory(syncPayload || []);
        setTallyStatus(tallyPayload);
        setSettingsForm((current) => ({
          ...current,
          companyName: tallyPayload.tallyCompany || "",
          deviceId: tallyPayload.deviceId || "",
        }));
        setBankProcessingConfig((current) => ({
          ...current,
          clientId: current.clientId || nextClients[0]?.id || "",
          companyName: current.companyName || nextClients[0]?.tallyCompanyName || tallyPayload.tallyCompany || "",
          bankName: current.bankName || nextClients[0]?.bankName || "Kotak Mahindra Bank",
        }));
        setDocumentForm((current) => ({
          ...current,
          clientId: current.clientId || nextClients[0]?.id || "",
        }));
      })
      .catch((error) => {
        if (!active) return;
        setBootError(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeClient) return;
    setBankProcessingConfig((current) => ({
      ...current,
      clientId: activeClient.id,
      companyName: activeClient.tallyCompanyName || activeClient.name,
      bankName: activeClient.bankName || current.bankName,
    }));
    setDocumentForm((current) => ({
      ...current,
      clientId: current.clientId || activeClient.id,
    }));
  }, [activeClient]);

  function addToast(message, tone = "info", duration = 2400) {
    const id = createId();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, duration);
  }

  function addActivity(text, status = "Resolved") {
    const item = { id: createId(), text, time: "Just now", status };
    setActivity((current) => [item, ...current].slice(0, 8));
  }

  function addSyncHistory(type, entries, status) {
    setSyncHistory((current) => [
      {
        id: createId(),
        time: "Just now",
        type,
        entries,
        status,
        company: tallyStatus.tallyCompany || activeClient?.name || "Primary Company",
      },
      ...current,
    ]);
  }

  function withFlash(rowIds) {
    setFlashRowIds((current) => Array.from(new Set([...current, ...rowIds])));
    window.setTimeout(() => {
      setFlashRowIds((current) => current.filter((id) => !rowIds.includes(id)));
    }, 320);
  }

  async function withBusy(key, task) {
    setBusy(key);
    setBootError("");
    try {
      await task();
    } catch (error) {
      setBootError(error.message);
      addToast(error.message, "error", 4000);
    } finally {
      setBusy("");
    }
  }

  function toggleRow(selected, setSelected, id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll(visibleRows, selected, setSelected) {
    const visibleIds = visibleRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => selected.includes(id));
    setSelected((current) => (allSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))));
  }

  function updateRowCollection(setter, id, field, value) {
    setter((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
              amount:
                field === "debit"
                  ? Number(value || 0) || Number(row.credit || 0)
                  : field === "credit"
                    ? Number(value || 0) || Number(row.debit || 0)
                    : row.amount,
              status: field === "status" ? value : "resolved",
              classificationStatus:
                field === "status"
                  ? row.classificationStatus
                  : row.classificationStatus
                    ? "confirmed"
                    : row.classificationStatus,
              ...(field === "debit" && Number(value || 0) > 0 ? { credit: 0 } : {}),
              ...(field === "credit" && Number(value || 0) > 0 ? { debit: 0 } : {}),
            }
          : row
      )
    );
    withFlash([id]);
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const payload = await loginUser(authForm.email, authForm.password);
      setAuthUser(payload.user);
      window.localStorage.setItem("tally-ai-session", JSON.stringify(payload));
      addToast(`Signed in as ${payload.user.name}.`, "success");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const payload = await signupUser(authForm.name, authForm.email, authForm.password);
      if (payload.sessionToken) {
        setAuthUser(payload.user);
        window.localStorage.setItem("tally-ai-session", JSON.stringify(payload));
        addToast(`Account created for ${payload.user.name}.`, "success");
      } else {
        setAuthMessage(payload.message || "Account created. Check your email to confirm your account.");
        setAuthMode("signin");
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    try {
      if (supabaseEnabled) {
        const payload = await requestPasswordReset(authForm.email);
        setAuthMessage(payload.message);
      } else if (!authForm.resetToken.trim()) {
        const payload = await requestPasswordReset(authForm.email);
        setAuthMessage(
          payload.resetToken
            ? `${payload.message} Your reset code is ${payload.resetToken}.`
            : payload.message
        );
        setAuthForm((current) => ({
          ...current,
          resetToken: payload.resetToken || "",
        }));
      } else {
        const payload = await resetPassword(authForm.resetToken, authForm.newPassword);
        setAuthMessage(payload.message);
        setAuthMode("signin");
        setAuthForm((current) => ({ ...current, password: "", newPassword: "", resetToken: "" }));
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleSignOut() {
    logoutUser().catch(() => {});
    setAuthUser(null);
    setAuthMode("signin");
    setAuthForm({ name: "", email: "", password: "", newPassword: "", resetToken: "" });
    setAuthMessage("");
    window.localStorage.removeItem("tally-ai-session");
    addToast("Signed out successfully.", "info");
  }

  async function handleCreateClient() {
    if (!clientForm.name.trim()) return;
    await withBusy("client-create", async () => {
      const payload = await createClient(clientForm);
      setClients((current) => [payload.client, ...current]);
      setClientForm({ name: "", bankName: clientForm.bankName, tallyCompanyName: "" });
      setBankProcessingConfig((current) => ({
        ...current,
        clientId: payload.client.id,
        companyName: payload.client.tallyCompanyName || payload.client.name,
        bankName: payload.client.bankName,
      }));
      addToast(`Client ${payload.client.name} created.`, "success");
    });
  }

  async function handleCreateDocumentRequest() {
    const client = clients.find((item) => item.id === documentForm.clientId);
    if (!client || !documentForm.title.trim()) return;
    await withBusy("document-request", async () => {
      const payload = await createDocumentRequest({
        ...documentForm,
        clientName: client.name,
      });
      setDocumentRequests((current) => [payload.request, ...current]);
      setDocumentForm((current) => ({ ...current, title: "", dueDate: "", notes: "" }));
      addToast("Document request logged for follow-up.", "success");
    });
  }

  async function handleCompleteDocument(id) {
    await withBusy("document-complete", async () => {
      await completeDocumentRequest(id);
      setDocumentRequests((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "Received" } : item))
      );
      addToast("Document request marked as received.", "success");
    });
  }

  async function handleBankUpload(file) {
    await withBusy("bank-upload", async () => {
      const payload = await uploadBankStatement(file, bankProcessingConfig);
      setBankStatement(payload);
      setBankRows(normalizeBankRows(payload));
      setBankProcessingConfig((current) => ({
        ...current,
        bankLedgerName: payload.tallyConfig?.bankLedgerName || current.bankLedgerName,
        intervalStart: payload.summary?.periodStart || current.intervalStart,
        intervalEnd: payload.summary?.periodEnd || current.intervalEnd,
      }));
      setActivePage("bank");
      addActivity(`Loaded bank statement ${file.name}`, "Resolved");
    });
  }

  async function handleBulkBankUpload(files) {
    await withBusy("bank-bulk-upload", async () => {
      const payload = await uploadBankStatementsBulk(files, bankProcessingConfig);
      setBulkBankJobs(payload.jobs || []);
      const firstSuccess = (payload.jobs || []).find((job) => job.status === "processed");
      if (firstSuccess?.statement) {
        setBankStatement(firstSuccess.statement);
        setBankRows(normalizeBankRows(firstSuccess.statement));
      }
      addActivity(`Processed ${payload.summary?.processedFiles || 0} bulk bank files`, "Resolved");
      addToast(`Bulk run completed for ${payload.summary?.totalFiles || files.length} files.`, "success");
    });
  }

  async function handleInvoiceUpload(file) {
    await withBusy("invoice-upload", async () => {
      const payload = await uploadInvoice(file, bankProcessingConfig);
      setInvoice(payload);
      setInvoiceRows(normalizeInvoiceRows(payload));
      setActivePage("invoice");
      addActivity(`Processed invoice ${payload.invoiceNumber || file.name}`, "Resolved");
    });
  }

  async function handleRecommendationUpload(file) {
    await withBusy("recommendation-upload", async () => {
      const payload = await analyzeRecommendations(file, bankProcessingConfig);
      setRecommendations(payload);
      setRecommendationRows(normalizeRecommendationRows(payload));
      setActivePage("recommendations");
      addActivity(`Prepared AI suggestions from ${file.name}`, "Resolved");
    });
  }

  async function handleBankHintApply() {
    if (!bankHint.trim()) return;
    await withBusy("bank-revise", async () => {
      const statementPayload = {
        ...bankStatement,
        summary: {
          ...bankStatement.summary,
          periodStart: bankProcessingConfig.intervalStart || bankStatement.summary?.periodStart,
          periodEnd: bankProcessingConfig.intervalEnd || bankStatement.summary?.periodEnd,
        },
        tallyConfig: {
          ...bankStatement.tallyConfig,
          companyName: bankProcessingConfig.companyName,
          clientId: bankProcessingConfig.clientId,
          bankName: bankProcessingConfig.bankName,
          bankLedgerName: bankProcessingConfig.bankLedgerName,
        },
        transactions: bankRows.map((row) => ({
          ...row.original,
          debit: row.debit,
          credit: row.credit,
          category: row.category,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          needsReview: row.status !== "resolved",
        })),
      };
      const revised = await reviseBankStatement(statementPayload, bankHint);
      setBankStatement(revised);
      const nextRows = normalizeBankRows(revised);
      setBankRows(nextRows);
      withFlash(nextRows.map((row) => row.id));
      addToast("Updated classifications using your instruction.", "success");
    });
  }

  async function handleInvoiceHintApply() {
    if (!invoiceHint.trim()) return;
    await withBusy("invoice-revise", async () => {
      const revised = await reviseInvoice(invoice, invoiceHint);
      setInvoice(revised);
      const nextRows = normalizeInvoiceRows(revised);
      setInvoiceRows(nextRows);
      withFlash(nextRows.map((row) => row.id));
      addToast("Updated invoice extraction using your instruction.", "success");
    });
  }

  async function handleLearnCurrentReview() {
    await withBusy("bank-learn", async () => {
      const statementPayload = {
        ...bankStatement,
        tallyConfig: {
          ...bankStatement.tallyConfig,
          companyName: bankProcessingConfig.companyName,
          clientId: bankProcessingConfig.clientId,
          bankName: bankProcessingConfig.bankName,
          bankLedgerName: bankProcessingConfig.bankLedgerName,
        },
        transactions: bankRows.map((row) => ({
          ...row.original,
          narration: row.particulars,
          debit: row.debit,
          credit: row.credit,
          category: row.category,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          debitAccount: row.debit > 0 ? row.ledger : bankProcessingConfig.bankLedgerName,
          creditAccount: row.credit > 0 ? row.ledger : bankProcessingConfig.bankLedgerName,
          needsReview: row.status !== "resolved",
        })),
      };
      const payload = await learnBankStatement(statementPayload, bankHint);
      addToast(payload.message || "Learned current review.", "success");
    });
  }

  async function handleTransactionCorrection(row, nextCategory) {
    try {
      const nextLedger = deriveLedgerFromCategory(nextCategory, row.particulars || row.normalised?.cleaned || "", row.txnType || "");
      await correctTransaction(row.id, {
        category: nextCategory,
        ledger: nextLedger,
        voucher_type: row.voucherType,
        narration: row.normalised?.cleaned || row.particulars || "",
        upiVpa: row.upiVpa || "",
        clientId: row.clientId || bankProcessingConfig.clientId || "",
      });

      setBankRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                category: nextCategory,
                ledger: nextLedger,
                classificationStatus: "confirmed",
                status: "resolved",
              }
            : item
        )
      );
      withFlash([row.id]);
      addToast("Saved correction and updated learned mapping rule.", "success");
    } catch (error) {
      addToast(error.message || "Could not save correction right now.", "error");
      throw error;
    }
  }

  async function handleBankDownloadXml() {
    const resolvedRows = bankRows.filter((row) => row.status === "resolved");
    if (!resolvedRows.length) {
      addToast("No resolved entries to export for Tally.", "error");
      return;
    }
    await withBusy("bank-export-xml", async () => {
      const payload = {
        ...bankStatement,
        summary: {
          ...bankStatement.summary,
          periodStart: bankProcessingConfig.intervalStart || bankStatement.summary?.periodStart,
          periodEnd: bankProcessingConfig.intervalEnd || bankStatement.summary?.periodEnd,
        },
        tallyConfig: {
          ...bankStatement.tallyConfig,
          companyName: bankProcessingConfig.companyName,
          clientId: bankProcessingConfig.clientId,
          bankName: bankProcessingConfig.bankName,
          bankLedgerName: bankProcessingConfig.bankLedgerName,
        },
        transactions: resolvedRows.map((row) => ({
          ...row.original,
          debit: row.debit,
          credit: row.credit,
          category: row.category,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          needsReview: false,
        })),
      };
      const blob = await downloadBankStatementXml(payload);
      downloadBlob(blob, `bank-vouchers-${new Date().toISOString().slice(0, 10)}.xml`);
      addToast("Vouchers XML ready for Tally import.", "success");
    });
  }

  async function handleRecommendationDownloadXml() {
    const resolvedRows = recommendationRows.filter((row) => row.status === "resolved");
    if (!resolvedRows.length) {
      addToast("No resolved recommendations to export for Tally.", "error");
      return;
    }
    await withBusy("recommendation-export-xml", async () => {
      const filteredPayload = {
        ...recommendations,
        mappings: recommendations.mappings.filter((item) => resolvedRows.some((row) => row.id === item.id)).map((item) => ({
          ...item,
          accepted: true,
          suggestion: {
            ...item.suggestion,
            ledgerHead: resolvedRows.find((row) => row.id === item.id)?.ledger || item.suggestion?.ledgerHead,
            voucherType: resolvedRows.find((row) => row.id === item.id)?.voucherType || item.suggestion?.voucherType,
          },
        })),
      };
      const blob = await downloadRecommendationXml(filteredPayload);
      downloadBlob(blob, `speedy-vouchers-${new Date().toISOString().slice(0, 10)}.xml`);
      addToast("Speedy Vouchers XML ready for Tally import.", "success");
    });
  }

  async function handleInvoiceDownloadXml() {
    await withBusy("invoice-export-xml", async () => {
      const blob = await downloadInvoiceXml(invoice);
      downloadBlob(blob, `invoice-voucher-${invoice.invoiceNumber || "export"}.xml`);
      addToast("Invoice XPML ready for Tally import.", "success");
    });
  }

  async function handleRecommendationHintApply() {
    if (!recommendationHint.trim()) return;
    await withBusy("recommendation-revise", async () => {
      const payload = await reviseRecommendations(recommendations, recommendationHint, bankProcessingConfig);
      setRecommendations(payload);
      const nextRows = normalizeRecommendationRows(payload);
      setRecommendationRows(nextRows);
      withFlash(nextRows.map((row) => row.id));
      addToast("Updated suggestions using your instruction.", "success");
    });
  }

  function approveSelected(setter, selected, ledgerOrResolved = "resolved") {
    setter((current) =>
      current.map((row) =>
        selected.includes(row.id)
          ? {
              ...row,
              ledger: ledgerOrResolved !== "resolved" ? ledgerOrResolved : row.ledger,
              status: "resolved",
              classificationStatus: markAsConfirmedIfClassified(row),
            }
          : row
      )
    );
    withFlash(selected);
  }

  function mapSuspense(setter) {
    setter((current) =>
      current.map((row) =>
        row.status !== "resolved"
          ? { ...row, ledger: "Suspense", status: "resolved", classificationStatus: markAsConfirmedIfClassified(row) }
          : row
      )
    );
    addToast("Mapped unresolved entries to Suspense.", "success");
  }

  function approveRecommendationCard(id) {
    setRecommendationRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, status: "resolved", classificationStatus: markAsConfirmedIfClassified(row) } : row
      )
    );
    withFlash([id]);
  }

  function applySpeedyGroup(group, draft) {
    setBankRows((current) =>
      current.map((row) =>
        group.rowIds.includes(row.id)
          ? {
              ...row,
              ledger: draft.ledger,
              voucherType: draft.voucherType,
              status: "resolved",
              classificationStatus: markAsConfirmedIfClassified(row),
            }
          : row
      )
    );
    setBankSelected((current) => Array.from(new Set([...current, ...group.rowIds])));
    withFlash(group.rowIds);
    addToast(`Approved ${group.count} grouped entries using Speedy.`, "success");
  }

  function markSpeedyGroupUnresolved(group) {
    setBankRows((current) =>
      current.map((row) =>
        group.rowIds.includes(row.id)
          ? {
              ...row,
              status: "pending",
              classificationStatus: row.classificationStatus === "auto_mapped" ? "suggested" : row.classificationStatus,
            }
          : row
      )
    );
    withFlash(group.rowIds);
    addToast(`Marked ${group.count} grouped entries as unresolved.`, "info");
  }

  function exportRowsToExcel(rows, filename, filters) {
    const visibleRows = getVisibleRows(rows, filters).map((row) => ({
      Status: row.status,
      Date: row.date,
      Particulars: row.particulars,
      Amount: row.amount,
      Debit: row.debit,
      Credit: row.credit,
      Category: row.category || "",
      Ledger: row.ledger,
      VoucherType: row.voucherType,
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(visibleRows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Entries");
    XLSX.writeFile(workbook, filename);
    addToast("Exporting to Excel...", "info", 2000);
  }

  async function handleBankPush(visibleRows) {
    const rowsToPush = (bankSelected.length ? visibleRows.filter((row) => bankSelected.includes(row.id)) : visibleRows).filter(
      (row) => row.status === "resolved"
    );
    if (!rowsToPush.length) {
      addToast("No resolved entries selected for Tally push.", "error");
      return;
    }

    addToast(`Pushing ${rowsToPush.length} entries to Tally...`, "info", 3000);
    await withBusy("bank-push", async () => {
      const payload = {
        ...bankStatement,
        summary: {
          ...bankStatement.summary,
          periodStart: bankProcessingConfig.intervalStart || bankStatement.summary?.periodStart,
          periodEnd: bankProcessingConfig.intervalEnd || bankStatement.summary?.periodEnd,
        },
        tallyConfig: {
          ...bankStatement.tallyConfig,
          companyName: bankProcessingConfig.companyName,
          clientId: bankProcessingConfig.clientId,
          bankName: bankProcessingConfig.bankName,
          bankLedgerName: bankProcessingConfig.bankLedgerName,
        },
        transactions: rowsToPush.map((row) => ({
          ...row.original,
          debit: row.debit,
          credit: row.credit,
          category: row.category,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          needsReview: false,
        })),
      };
      
      const configPayload = {
        ...settingsForm,
        companyName: bankProcessingConfig.companyName || settingsForm.companyName,
        clientId: bankProcessingConfig.clientId
      };
      
      const result = await pushBankStatementToTally(payload, configPayload);
      let processed = 0;
      rowsToPush.forEach((row, index) => {
        window.setTimeout(() => {
          setBankRows((current) =>
            current.map((item) => (item.id === row.id ? { ...item, status: result.success === false ? "failed" : "resolved" } : item))
          );
        }, index * 120);
        processed += 1;
      });
      addToast(`${processed} entries pushed successfully. ${result.success === false ? processed : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Bank", processed, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handleInvoicePush() {
    addToast("Pushing 1 entry to Tally...", "info", 3000);
    await withBusy("invoice-push", async () => {
      const configPayload = {
        ...settingsForm,
        companyName: activeClient?.tallyCompanyName || activeClient?.name || settingsForm.companyName,
        clientId: activeClient?.id
      };
      const result = await pushInvoiceToTally(invoice, configPayload);
      setInvoiceRows((current) => current.map((row) => ({ ...row, status: result.success === false ? "failed" : "resolved" })));
      addToast(`1 entry pushed successfully. ${result.success === false ? 1 : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Invoice", 1, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handleRecommendationPush(visibleRows) {
    const rowsToPush = (recommendationSelected.length ? visibleRows.filter((row) => recommendationSelected.includes(row.id)) : visibleRows).filter(
      (row) => row.status === "resolved"
    );
    if (!rowsToPush.length) {
      addToast("No resolved recommendations selected for Tally push.", "error");
      return;
    }

    addToast(`Pushing ${rowsToPush.length} entries to Tally...`, "info", 3000);
    await withBusy("recommendation-push", async () => {
      const filteredPayload = {
        ...recommendations,
        mappings: recommendations.mappings.filter((item) => rowsToPush.some((row) => row.id === item.id)).map((item) => ({
          ...item,
          accepted: true,
          suggestion: {
            ...item.suggestion,
            ledgerHead: rowsToPush.find((row) => row.id === item.id)?.ledger || item.suggestion?.ledgerHead,
            voucherType: rowsToPush.find((row) => row.id === item.id)?.voucherType || item.suggestion?.voucherType,
          },
        })),
      };

      const xmlBlob = await downloadRecommendationXml(filteredPayload);
      const xml = await xmlBlob.text();
      const configPayload = {
        ...settingsForm,
        companyName: activeClient?.tallyCompanyName || activeClient?.name || settingsForm.companyName,
        clientId: activeClient?.id
      };
      const result = await pushXmlToTally(xml, configPayload);
      rowsToPush.forEach((row, index) => {
        window.setTimeout(() => {
          setRecommendationRows((current) =>
            current.map((item) => (item.id === row.id ? { ...item, status: result.success === false ? "failed" : "resolved" } : item))
          );
        }, index * 120);
      });
      addToast(`${rowsToPush.length} entries pushed successfully. ${result.success === false ? rowsToPush.length : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Recommendations", rowsToPush.length, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handlePairing() {
    await withBusy("pairing", async () => {
      const payload = await createPairingCode();
      setPairingCode(payload.pairingCode || "");
      setPairingModalOpen(true);
    });
  }

  async function handleTestConnection() {
    await withBusy("test-connection", async () => {
      const payload = await testTallyConnection(settingsForm);
      setTestConnectionResult(payload.tallyConnected || payload.connectorConnected ? "Connected" : "Failed");
      addToast(payload.tallyConnected || payload.connectorConnected ? "Connected" : "Failed", payload.tallyConnected || payload.connectorConnected ? "success" : "error");
    });
  }

  async function handleTestAi() {
    const hasKey = Boolean(settingsForm.anthropicApiKey || settingsForm.showApiKey);
    addToast(
      hasKey
        ? "AI is configured on the server. Upload a bank statement to verify live classification."
        : "Anthropic API key is managed on the server. Add it in Render, then upload a statement to test AI.",
      "info"
    );
  }

  async function handleReconcile(gstr2bFile, purchaseRegisterFile) {
    await withBusy("gst-reconcile", async () => {
      const payload = await reconcileGst(gstr2bFile, purchaseRegisterFile);
      setGstReport(payload);
      addToast("GST reconciliation completed.", "success");
    });
  }

  const bankRecommendationCards = bankRows.filter((row) => row.status === "pending").slice(0, 8);
  const speedyGroups = useMemo(() => buildSpeedyGroups(bankRows), [bankRows]);
  const recommendationCards = recommendationRows.filter((row) => row.status === "pending").slice(0, 8);
  const invoiceCards = invoiceRows.filter((row) => row.status === "pending").slice(0, 8);

  const dashboardStats = [
    { label: "Entries Pushed Today", value: formatNumber(syncHistory.reduce((sum, item) => sum + item.entries, 0)), change: "+12 today", icon: Send },
    { label: "Invoices Processed", value: formatNumber(invoiceRows.length || 1), change: "+3 this week", icon: Receipt },
    { label: "Bank Rows Mapped", value: formatNumber(bankRows.length), change: "+84 today", icon: Landmark },
    { label: "Hours Saved", value: "17.5", change: "+2.4 today", icon: Clock3 },
  ];

  if (!authUser) {
    return (
      <SignInPage
        mode={authMode}
        setMode={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        error={authError}
        busy={authBusy}
        message={authMessage}
        onSubmit={authMode === "signup" ? handleSignUp : authMode === "forgot" ? handleForgotPassword : handleSignIn}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        supabaseEnabled={supabaseEnabled}
      />
    );
  }

  if (!authUser.onboardingComplete) {
    return (
      <OnboardingWizard user={authUser} onComplete={() => setAuthUser(current => ({ ...current, onboardingComplete: true }))} />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-[#111827]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-[#A78BFA]/20 blur-3xl" />
        <div className="absolute right-[-4rem] top-28 h-96 w-96 rounded-full bg-[#67E8F9]/18 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-1/3 h-96 w-96 rounded-full bg-[#F9A8D4]/14 blur-3xl" />
      </div>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/20 bg-[#1E1B4B]/86 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur-2xl transition-all duration-200 md:translate-x-0",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#7C3AED_0%,#4F46E5_100%)]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              {!sidebarCollapsed ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight">Tally AI</span>
                  <Sparkles className="h-3 w-3 text-[#A78BFA]" />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden rounded-md p-1 text-white/80 hover:bg-white/10 md:inline-flex"
            >
              {sidebarCollapsed ? <ArrowRightToLine className="h-4 w-4" /> : <ArrowLeftToLine className="h-4 w-4" />}
            </button>
          </div>
          <div className="mx-4 border-b border-white/10" />
          <nav className="mt-3 flex-1 px-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={cn(
                    "mb-1 flex w-full items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "border-l-[#7C3AED] bg-white/10"
                      : "border-l-transparent hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3">
              <UserCircle2 className="h-8 w-8 text-white/90" />
              {!sidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{authUser.name}</div>
                    <div className="text-xs text-white/70">{authUser.role || "Signed in"}</div>
                  </div>
                  <button type="button" onClick={handleSignOut} className="rounded-md p-1 text-white/70 hover:bg-white/10">
                    <LogOut className="h-4 w-4 text-white/70" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </aside>

        {mobileSidebarOpen ? <button type="button" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileSidebarOpen(false)} /> : null}

        <div className="flex-1 md:ml-[220px]" style={{ marginLeft: sidebarCollapsed && window.innerWidth >= 768 ? SIDEBAR_COLLAPSED_WIDTH : undefined }}>
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-white/60 bg-white/55 px-4 backdrop-blur-2xl md:px-6">
            <div className="flex items-center gap-3">
              <AppIconButton className="h-9 w-9 md:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </AppIconButton>
              <div className="text-[18px] font-semibold text-[#111827]">{pageTitle}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 md:flex">
                <Building2 className="h-4 w-4 text-[#6B7280]" />
                <div className="text-sm font-medium text-[#374151]">{tallyStatus.tallyCompany || activeClient?.name || "No Company Selected"}</div>
              </div>
              <TallyStatusBadge onConnectClick={handlePairing} onStatus={(payload) => setTallyStatus(payload)} />
              <AppIconButton className="h-9 w-9">
                <Bell className="h-4 w-4" />
              </AppIconButton>
              <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5">
                <UserCircle2 className="h-8 w-8 text-[#6B7280]" />
                <div className="hidden text-left md:block">
                  <div className="text-sm font-medium text-[#111827]">{authUser.name}</div>
                  <div className="text-[11px] text-[#6B7280]">{authUser.role}</div>
                </div>
              </div>
            </div>
          </header>

          {!tallyStatus.connectorConnected && (
            <div className="flex items-center justify-between bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309] border-b border-[#FEF3C7]">
              <div><strong>Tally is not connected.</strong> Some features are unavailable.</div>
              <button type="button" onClick={handlePairing} className="font-semibold hover:underline">Set up connection &rarr;</button>
            </div>
          )}

          <main className="px-4 py-5 md:px-6">
            {bootError ? <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{bootError}</div> : null}
            {busy ? <div className="mb-4 rounded-lg border border-[#E9D5FF] bg-[#F5F3FF] px-4 py-3 text-sm text-[#6D28D9]">Working on {busy.replace(/-/g, " ")}...</div> : null}

            {activePage === "dashboard" ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {dashboardStats.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="glass-panel rounded-3xl border border-white/70 p-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-[13px] text-[#6B7280]">{card.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-[#111827]">{card.value}</div>
                        <div className="mt-2 text-sm text-[#16A34A]">{card.change}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
                    <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold">Recent Activity</div>
                    {activity.length > 0 ? (
                      <div className="divide-y divide-[#F3F4F6]">
                        {activity.map((item) => (
                          <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
                              <Clock3 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[#111827]">{item.text}</div>
                              <div className="mt-1 text-xs text-[#6B7280]">{item.time}</div>
                            </div>
                            <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5">
                        <EmptyState 
                          icon={Clock3} 
                          title="No activity yet" 
                          description="Upload a bank statement or invoice to get started." 
                        />
                      </div>
                    )}
                  </div>

                  <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
                    <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold">Tally Sync History</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                          <tr>
                            <th className="px-4 py-3 font-medium">Time</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Entries</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Company</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncHistory.map((item) => (
                            <tr key={item.id} className="border-b border-[#F3F4F6]">
                              <td className="px-4 py-3">{item.time}</td>
                              <td className="px-4 py-3">{item.type}</td>
                              <td className="px-4 py-3">{item.entries}</td>
                              <td className="px-4 py-3">
                                <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                              </td>
                              <td className="px-4 py-3">{item.company}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                  <div className="text-lg font-semibold text-[#111827]">Quick Actions</div>
                  <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <Button variant="primary" onClick={() => setActivePage("bank")} className="w-full justify-center">Upload Bank Statement</Button>
                    <Button variant="ghost" onClick={() => setActivePage("invoice")} className="w-full justify-center">Upload Invoice</Button>
                    <Button variant="outlinePurple" onClick={() => setActivePage("gst")} className="w-full justify-center">GST Reconcile</Button>
                    <Button variant="ghost" onClick={() => setActivePage("history")} className="w-full justify-center">View History</Button>
                  </div>
                </div>
              </div>
            ) : null}

            {activePage === "clients" ? (
              <ClientsPage
                clients={clients}
                documentRequests={documentRequests}
                bankOptions={bankOptions}
                clientForm={clientForm}
                setClientForm={setClientForm}
                onCreateClient={handleCreateClient}
                documentForm={documentForm}
                setDocumentForm={setDocumentForm}
                onCreateDocumentRequest={handleCreateDocumentRequest}
                onCompleteDocument={handleCompleteDocument}
              />
            ) : null}

            {activePage === "bank" ? (
              <div className="space-y-6">
                <StepIndicator 
                  currentStep={bankStatement.originalFileName ? bankRows.filter(r => r.status === "pending").length === 0 ? 4 : 3 : 1} 
                  steps={["Upload", "Configure", "Review", "Push"]} 
                />
                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <BulkFileDropCard
                      title="Bulk quarterly or monthly upload"
                      helper="Upload multiple PDF statements together. The queue processes them in bulk and keeps failed files separate."
                      accept="application/pdf"
                      onSelect={handleBulkBankUpload}
                    />
                    <FileDropCard
                      title="Upload bank statement"
                      helper="Upload a PDF statement and review AI-mapped ledger suggestions in the table."
                      accept="application/pdf"
                      onSelect={handleBankUpload}
                    />
                    <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                      <div className="text-sm font-semibold text-[#111827]">Processing Configuration</div>
                      <div className="mt-4 space-y-4">
                        <Field label="Client / Company">
                          <select
                            value={bankProcessingConfig.clientId}
                            onChange={(event) => {
                              const client = clients.find((item) => item.id === event.target.value);
                              setBankProcessingConfig((current) => ({
                                ...current,
                                clientId: event.target.value,
                                companyName: client?.tallyCompanyName || client?.name || "",
                                bankName: client?.bankName || current.bankName,
                              }));
                            }}
                            className="settings-input"
                          >
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Bank Name">
                          <select
                            value={bankProcessingConfig.bankName}
                            onChange={(event) =>
                              setBankProcessingConfig((current) => ({ ...current, bankName: event.target.value }))
                            }
                            className="settings-input"
                          >
                            {bankOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Tally Company Name">
                          <input
                            value={bankProcessingConfig.companyName}
                            onChange={(event) =>
                              setBankProcessingConfig((current) => ({ ...current, companyName: event.target.value }))
                            }
                            className="settings-input"
                          />
                        </Field>
                        <Field label="Bank Ledger">
                          <select
                            value={bankProcessingConfig.bankLedgerName}
                            onChange={(event) =>
                              setBankProcessingConfig((current) => ({ ...current, bankLedgerName: event.target.value }))
                            }
                            className="settings-input"
                          >
                            {ledgerOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Interval Start">
                            <input
                              type="date"
                              value={bankProcessingConfig.intervalStart}
                              onChange={(event) =>
                                setBankProcessingConfig((current) => ({ ...current, intervalStart: event.target.value }))
                              }
                              className="settings-input"
                            />
                          </Field>
                          <Field label="Interval End">
                            <input
                              type="date"
                              value={bankProcessingConfig.intervalEnd}
                              onChange={(event) =>
                                setBankProcessingConfig((current) => ({ ...current, intervalEnd: event.target.value }))
                              }
                              className="settings-input"
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                    <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-[#111827]">Bulk Processing Queue</div>
                          <div className="mt-1 text-xs text-[#6B7280]">Process hundreds of entries file by file and resume review from the queue.</div>
                        </div>
                        <div className="rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-semibold text-[#7C3AED]">{bulkBankJobs.length} jobs</div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {bulkBankJobs.length ? bulkBankJobs.map((job) => (
                          <button
                            key={job.id}
                            type="button"
                            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-left"
                            onClick={() => {
                              if (job.statement) {
                                setBankStatement(job.statement);
                                setBankRows(normalizeBankRows(job.statement));
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[#111827]">{job.fileName}</div>
                                <div className="mt-1 text-xs text-[#6B7280]">{job.transactionCount || 0} rows • {job.reviewCount || 0} review</div>
                              </div>
                              <Badge status={job.status === "processed" ? "resolved" : "failed"} confidence="medium" />
                            </div>
                            {job.error ? <div className="mt-2 text-xs text-[#B91C1C]">{job.error}</div> : null}
                          </button>
                        )) : (
                          <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-4 text-sm text-[#6B7280]">
                            No bulk files processed yet.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[13px] text-[#6B7280]">Total Debits</div>
                          <div className="mt-1 text-xl font-semibold text-[#111827]">{formatCurrency(bankRows.reduce((sum, row) => sum + row.debit, 0))}</div>
                        </div>
                        <div>
                          <div className="text-[13px] text-[#6B7280]">Total Credits</div>
                          <div className="mt-1 text-xl font-semibold text-[#111827]">{formatCurrency(bankRows.reduce((sum, row) => sum + row.credit, 0))}</div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button variant="outlinePurple" className="w-full justify-center" onClick={handleLearnCurrentReview}>
                          <Sparkles className="h-4 w-4" />
                          Learn From Current Review
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold text-[#111827]">Smart Categorization</div>
                          <div className="mt-1 text-sm text-[#6B7280]">
                            Similar entries are clubbed together so you can assign one ledger and voucher type in bulk.
                          </div>
                        </div>
                        <div className="rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7C3AED]">
                          {speedyGroups.length} groups
                        </div>
                      </div>
                      <div className="mt-4">
                        <SpeedyGroupPanel
                          groups={speedyGroups}
                          ledgerOptions={ledgerOptions}
                          onApproveGroup={applySpeedyGroup}
                          onMarkGroupUnresolved={markSpeedyGroupUnresolved}
                        />
                      </div>
                    </div>

                    <EntryTable
                      title="Entry Management"
                      subtitle="Review grouped suggestions, modify specific rows, or leave unchecked rows unresolved for smaller batches later."
                      rows={bankRows}
                      rowType="bank"
                      ledgerOptions={ledgerOptions}
                      filters={bankFilters}
                      onFiltersChange={setBankFilters}
                      selectedRowIds={bankSelected}
                      onToggleRow={(id) => toggleRow(bankSelected, setBankSelected, id)}
                      onToggleAll={() => toggleAll(getVisibleRows(bankRows, bankFilters), bankSelected, setBankSelected)}
                      onFieldChange={(id, field, value) => updateRowCollection(setBankRows, id, field, value)}
                      onApproveSelected={(ledger) => approveSelected(setBankRows, bankSelected, ledger)}
                      onMapSuspense={() => mapSuspense(setBankRows)}
                      onExport={() => exportRowsToExcel(bankRows, "bank-entries.xlsx", bankFilters)}
                      onSendToTally={handleBankPush}
                      recommendationCards={bankRecommendationCards}
                      onApproveRecommendation={(id) => {
                        setBankRows((current) =>
                          current.map((row) =>
                            row.id === id
                              ? { ...row, status: "resolved", classificationStatus: markAsConfirmedIfClassified(row) }
                              : row
                          )
                        );
                        withFlash([id]);
                      }}
                      aiHint={bankHint}
                      onAiHintChange={setBankHint}
                      onApplyAiHint={handleBankHintApply}
                      onDownloadXml={handleBankDownloadXml}
                      flashRowIds={flashRowIds}
                      onCorrectTransaction={handleTransactionCorrection}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {activePage === "invoice" ? (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <FileDropCard
                      title="Upload invoice or image"
                      helper="Review extracted invoice fields and line items before sending a purchase voucher to Tally."
                      accept="application/pdf,image/png,image/jpeg"
                      onSelect={handleInvoiceUpload}
                    />
                    <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[13px] font-medium text-[#6B7280] uppercase tracking-wider">Invoice Details</div>
                          <div className="mt-2 text-lg font-semibold text-[#111827]">{invoice.invoiceNumber || "Awaiting upload"}</div>
                          <div className="mt-1 text-sm text-[#6B7280]">{invoice.vendorName || "Vendor will appear here"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-[#111827]">{invoice.totalAmount ? formatCurrency(invoice.totalAmount) : "₹0.00"}</div>
                          <div className="mt-1 text-xs font-medium text-[#6B7280]">{invoice.invoiceDate || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <EntryTable
                    title="Invoice Line Entry Management"
                    subtitle="Edit extracted line items, adjust amounts, and confirm the purchase voucher before pushing."
                    rows={invoiceRows}
                    ledgerOptions={ledgerOptions}
                    filters={invoiceFilters}
                    onFiltersChange={setInvoiceFilters}
                    selectedRowIds={invoiceSelected}
                    onToggleRow={(id) => toggleRow(invoiceSelected, setInvoiceSelected, id)}
                    onToggleAll={() => toggleAll(getVisibleRows(invoiceRows, invoiceFilters), invoiceSelected, setInvoiceSelected)}
                    onFieldChange={(id, field, value) => updateRowCollection(setInvoiceRows, id, field, value)}
                    onApproveSelected={(ledger) => approveSelected(setInvoiceRows, invoiceSelected, ledger)}
                    onMapSuspense={() => mapSuspense(setInvoiceRows)}
                    onExport={() => exportRowsToExcel(invoiceRows, "invoice-entries.xlsx", invoiceFilters)}
                    onSendToTally={handleInvoicePush}
                    recommendationCards={invoiceCards}
                    onApproveRecommendation={(id) => {
                      setInvoiceRows((current) => current.map((row) => (row.id === id ? { ...row, status: "resolved" } : row)));
                      withFlash([id]);
                    }}
                    aiHint={invoiceHint}
                    onAiHintChange={setInvoiceHint}
                    onApplyAiHint={handleInvoiceHintApply}
                    onDownloadXml={handleInvoiceDownloadXml}
                    flashRowIds={flashRowIds}
                  />
                </div>
              </div>
            ) : null}

            {activePage === "recommendations" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <FileDropCard
                    title="Upload recommendation sheet"
                    helper="Upload a Tally or bank export and review the suggested ledger mapping queue."
                    accept=".xlsx,.xls,.csv"
                    onSelect={handleRecommendationUpload}
                  />
                  <div className="glass-panel rounded-[28px] border border-white/70 p-5">
                    <div className="text-[13px] text-[#6B7280]">Learned mappings</div>
                    <div className="mt-1 text-xl font-semibold text-[#111827]">{formatNumber(recommendations.learningSummary?.learnedRuleCount || 0)}</div>
                    <div className="mt-2 text-sm text-[#6B7280]">Stored review patterns improving future classification.</div>
                  </div>
                </div>

                <EntryTable
                  title="Speedy Recommendation Queue"
                  subtitle="Approve AI ledger suggestions in bulk, adjust voucher types or values, and push only the resolved entries to Tally."
                  rows={recommendationRows}
                  ledgerOptions={ledgerOptions}
                  filters={recommendationFilters}
                  onFiltersChange={setRecommendationFilters}
                  selectedRowIds={recommendationSelected}
                  onToggleRow={(id) => toggleRow(recommendationSelected, setRecommendationSelected, id)}
                  onToggleAll={() => toggleAll(getVisibleRows(recommendationRows, recommendationFilters), recommendationSelected, setRecommendationSelected)}
                  onFieldChange={(id, field, value) => updateRowCollection(setRecommendationRows, id, field, value)}
                  onApproveSelected={(ledger) => approveSelected(setRecommendationRows, recommendationSelected, ledger)}
                  onMapSuspense={() => mapSuspense(setRecommendationRows)}
                  onExport={() => exportRowsToExcel(recommendationRows, "speedy-recommendations.xlsx", recommendationFilters)}
                  onSendToTally={handleRecommendationPush}
                  recommendationCards={recommendationCards}
                  onApproveRecommendation={approveRecommendationCard}
                  aiHint={recommendationHint}
                  onAiHintChange={setRecommendationHint}
                  onApplyAiHint={handleRecommendationHintApply}
                  onDownloadXml={handleRecommendationDownloadXml}
                  flashRowIds={flashRowIds}
                />
              </div>
            ) : null}

            {activePage === "gst" ? (
              <GstPage report={gstReport} onReconcile={handleReconcile} />
            ) : null}

            {activePage === "history" ? (
              <HistoryPage activity={activity} syncHistory={syncHistory} />
            ) : null}

            {activePage === "settings" ? (
              <SettingsPage
                form={settingsForm}
                setForm={setSettingsForm}
                testConnectionResult={testConnectionResult}
                onTestConnection={handleTestConnection}
                onConnectTally={handlePairing}
                onTestAI={handleTestAi}
                tallyStatus={tallyStatus}
                busy={busy}
              />
            ) : null}
          </main>
        </div>
      </div>

      <PairingModal open={pairingModalOpen} code={pairingCode} connected={tallyStatus.tallyConnected} onClose={() => setPairingModalOpen(false)} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}

function GstPage({ report, onReconcile }) {
  const [files, setFiles] = useState({ gstr2b: null, purchaseRegister: null });
  const [activeTab, setActiveTab] = useState("all");

  const filteredRows = report.rows.filter(row => {
    if (activeTab === "matched") return row.status === "matched";
    if (activeTab === "mismatched") return row.status !== "matched";
    return true;
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <FileDropCard title={files.gstr2b?.name || "Upload GSTR-2B"} helper="Excel or PDF export from GST portal." accept=".xlsx,.xls,.csv,application/pdf" onSelect={(file) => setFiles((current) => ({ ...current, gstr2b: file }))} />
        <FileDropCard title={files.purchaseRegister?.name || "Upload purchase register"} helper="Excel or PDF purchase register for the same period." accept=".xlsx,.xls,.csv,application/pdf" onSelect={(file) => setFiles((current) => ({ ...current, purchaseRegister: file }))} />
        <Button variant="primary" className="w-full justify-center" disabled={!files.gstr2b || !files.purchaseRegister} onClick={() => onReconcile(files.gstr2b, files.purchaseRegister)}>
          Reconcile
        </Button>
        <details className="glass-panel rounded-[28px] border border-white/70 p-4 cursor-pointer group">
          <summary className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7C3AED] select-none outline-none">Supported Headers</summary>
          <div className="mt-3 space-y-2 text-[11px] text-[#6B7280]">
            <div><strong>Invoice:</strong> Vch No, Voucher No, Invoice No, Bill No</div>
            <div><strong>GSTIN:</strong> GSTIN of supplier, Registration No, Registration Number</div>
            <div><strong>Amount:</strong> Taxable Value, CGST, SGST, IGST, Total Amount</div>
          </div>
        </details>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {report.summary.total > 0 ? (
          <>
            <div className="grid gap-4 border-b border-[#E5E7EB] px-5 py-4 md:grid-cols-5">
              <StatMini label="Matched" value={formatNumber(report.summary.matched)} tone="text-[#16A34A]" />
              <StatMini label="Partial" value={formatNumber(report.summary.partial)} tone="text-[#D97706]" />
              <StatMini label="Unmatched" value={formatNumber(report.summary.unmatched)} tone="text-[#DC2626]" />
              <StatMini label="Duplicate" value={formatNumber(report.summary.duplicateInvoices || 0)} tone="text-[#DC2626]" />
              <StatMini label="Missing GSTIN" value={formatNumber(report.summary.missingGstin || 0)} tone="text-[#D97706]" />
            </div>
            <div className="flex items-center gap-4 border-b border-[#E5E7EB] px-5">
              {['all', 'matched', 'mismatched'].map(tab => (
                <button
                  key={tab}
                  className={cn("border-b-2 px-1 py-4 text-sm font-medium transition-colors", activeTab === tab ? "border-[#7C3AED] text-[#7C3AED]" : "border-transparent text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#374151]")}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <div className="ml-auto py-4 text-sm text-[#4B5563]">
                Exact match rate: <span className="font-semibold text-[#111827]">{report.summary.exactMatchRate || 0}%</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Risk Bucket</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#F3F4F6] bg-white hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <Badge status={row.status === "matched" ? "resolved" : row.status === "partial" ? "pending" : "failed"} confidence="medium" />
                      </td>
                      <td className="px-4 py-3">{row.invoiceNumber}</td>
                      <td className="px-4 py-3">{row.gstin || "—"}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-4 py-3">{row.riskBucket || "—"}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{row.mismatchReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-[#F3F4F6] p-4">
              <ShieldCheck className="h-8 w-8 text-[#9CA3AF]" />
            </div>
            <div className="mt-4 text-lg font-semibold text-[#111827]">No reconciliation data yet</div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Upload your GSTR-2B and Purchase Register files to start the reconciliation process.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPage({ activity, syncHistory }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
        <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold">Recent Activity</div>
        <div className="divide-y divide-[#F3F4F6]">
          {activity.length > 0 ? activity.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#F9FAFB] transition-colors">
              <div>
                <div className="text-sm font-medium text-[#111827]">{item.text}</div>
                <div className="mt-1 text-xs text-[#6B7280]">{item.time}</div>
              </div>
              <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
            </div>
          )) : (
            <div className="p-5 flex flex-col items-center text-center">
              <div className="rounded-full bg-[#F3F4F6] p-3 mb-2"><History className="h-5 w-5 text-[#9CA3AF]" /></div>
              <div className="text-sm font-medium text-[#111827]">No activity logs</div>
              <div className="text-xs text-[#6B7280]">Any recent platform actions will appear here.</div>
            </div>
          )}
        </div>
      </div>
      <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
        <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold">Tally Sync History</div>
        <div className="overflow-x-auto">
          {syncHistory.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Entries</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((item) => (
                  <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 whitespace-nowrap">{item.time}</td>
                    <td className="px-4 py-3 font-medium text-[#111827] whitespace-nowrap">{item.type}</td>
                    <td className="px-4 py-3 text-[#6B7280] font-mono">{item.entries}</td>
                    <td className="px-4 py-3">
                      <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] truncate max-w-[120px]">{item.company}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 flex flex-col items-center text-center">
              <div className="rounded-full bg-[#F3F4F6] p-4 mb-3"><Landmark className="h-6 w-6 text-[#9CA3AF]" /></div>
              <div className="text-[15px] font-semibold text-[#111827]">No Tally Syncs Yet</div>
              <div className="text-sm mt-1 text-[#6B7280]">Records synced to Tally will be tracked here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientsPage({ clients, documentRequests, bankOptions, clientForm, setClientForm, onCreateClient, documentForm, setDocumentForm, onCreateDocumentRequest, onCompleteDocument }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
          <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold text-[#111827]">Clients</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Tally Company</th>
                  <th className="px-5 py-3 font-medium">Bank</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-4 font-medium text-[#111827]">{client.name}</td>
                    <td className="px-5 py-4">{client.tallyCompanyName || "—"}</td>
                    <td className="px-5 py-4 text-[#6B7280]">{client.bankName || "—"}</td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-5 py-8 text-center text-sm text-[#6B7280]">No clients added yet. Add your first client below.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel flex max-h-[600px] flex-col rounded-[28px] border border-white/70 shadow-panel">
          <div className="shrink-0 border-b border-white/50 px-5 py-4">
            <div className="text-lg font-semibold text-[#111827]">Document Inbox</div>
            <div className="mt-1 text-xs text-[#6B7280]">Pending and received files from clients.</div>
          </div>
          <div className="overflow-y-auto p-5 space-y-3">
            {documentRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">{request.title}</div>
                    <div className="mt-1 text-xs text-[#6B7280]">{request.clientName} • {request.channel} • Due {request.dueDate || "open"}</div>
                  </div>
                  <Badge status={request.status === "Received" ? "resolved" : request.status === "In Review" ? "pending" : "failed"} confidence="medium" />
                </div>
                {request.status !== "Received" && (
                  <div className="mt-3">
                    <Button variant="ghost" className="px-3 py-1.5 text-xs w-full justify-center" onClick={() => onCompleteDocument(request.id)}>
                      Mark Received
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {documentRequests.length === 0 && (
              <div className="py-8 text-center text-sm text-[#6B7280]">No document requests.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-panel rounded-[28px] border border-white/70 p-5">
          <div className="text-lg font-semibold text-[#111827]">Add Client</div>
          <div className="mt-5 space-y-4">
            <Field label="Client Name">
              <input value={clientForm.name} onChange={(e) => setClientForm(c => ({ ...c, name: e.target.value }))} className="settings-input" />
            </Field>
            <Field label="Primary Bank">
              <select value={clientForm.bankName} onChange={(e) => setClientForm(c => ({ ...c, bankName: e.target.value }))} className="settings-input">
                {bankOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Tally Company Name">
              <input value={clientForm.tallyCompanyName} onChange={(e) => setClientForm(c => ({ ...c, tallyCompanyName: e.target.value }))} className="settings-input" />
            </Field>
            <Button variant="primary" className="w-full justify-center" onClick={onCreateClient}>
              Create Client
            </Button>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] border border-white/70 p-5">
          <div className="text-lg font-semibold text-[#111827]">Request Documents</div>
          <div className="mt-5 space-y-4">
            <Field label="Client">
              <select value={documentForm.clientId} onChange={(e) => setDocumentForm(c => ({ ...c, clientId: e.target.value }))} className="settings-input">
                <option value="">Select a Client</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </Field>
            <Field label="Document Request">
              <input value={documentForm.title} onChange={(e) => setDocumentForm(c => ({ ...c, title: e.target.value }))} className="settings-input" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Channel">
                <select value={documentForm.channel} onChange={(e) => setDocumentForm(c => ({ ...c, channel: e.target.value }))} className="settings-input">
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>Phone Call</option>
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" value={documentForm.dueDate} onChange={(e) => setDocumentForm(c => ({ ...c, dueDate: e.target.value }))} className="settings-input" />
              </Field>
            </div>
            <Button variant="primary" className="w-full justify-center" onClick={onCreateDocumentRequest}>Log Request</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ form, setForm, testConnectionResult, onTestConnection, onConnectTally, onTestAI, tallyStatus, busy }) {
  const connectorReleasesUrl = "https://github.com/mukundankandas5-ctrl/tally/releases/latest";

  return (
    <div className="space-y-6">
      <SettingsCard title="Tally Connector — Download & Setup">
        <div className="rounded-xl border border-[#E9D5FF] bg-[linear-gradient(135deg,#FAF5FF_0%,#F5F3FF_100%)] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                <Download className="h-3.5 w-3.5" /> Windows App
              </div>
              <h3 className="mt-3 text-xl font-semibold text-[#111827]">Tally AI Connector</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                A lightweight Windows app that bridges your TallyPrime desktop with this cloud workspace.
                Download, install, pair — and your vouchers push directly into Tally.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="/api/connector-download"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)] transition hover:bg-[#6D28D9] hover:shadow-[0_4px_16px_rgba(124,58,237,0.4)]"
                >
                  <Download className="h-4 w-4" />
                  Download latest .exe
                </a>
                <a
                  href={connectorReleasesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
                >
                  View All Releases
                </a>
              </div>
              <p className="mt-3 text-xs text-[#9CA3AF]">
                Latest Windows build · Windows 8.1 / 10 / 11 · 32-bit & 64-bit · Requires TallyPrime running on the same PC
              </p>
            </div>

            <div className="w-full max-w-sm shrink-0">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7C3AED]">Quick Setup</div>
              <div className="mt-3 space-y-3">
                <div className="flex gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-bold text-white">1</div>
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">Download & Install</div>
                    <div className="mt-1 text-xs leading-5 text-[#6B7280]">Click the download button, run the installer on your Windows PC where TallyPrime is installed.</div>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-bold text-white">2</div>
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">Generate Pairing Code</div>
                    <div className="mt-1 text-xs leading-5 text-[#6B7280]">Click "Generate Pairing Code" below to get a 6-digit code for your connector.</div>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-bold text-white">3</div>
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">Enter Code in Connector</div>
                    <div className="mt-1 text-xs leading-5 text-[#6B7280]">Open the Connector app, paste your backend URL and the pairing code, then click Pair. Done!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button variant="primary" onClick={onConnectTally} disabled={busy === "pairing"}>
            <Send className="h-4 w-4" />
            Generate Pairing Code
          </Button>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-sm text-[#6B7280]">
            Backend URL for the connector: <strong className="select-all text-[#111827]">{window.location.origin}</strong>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Connector Status">
        <div className="grid gap-4 md:grid-cols-4">
          <StatMini label="Connector" value={tallyStatus.connectorConnected ? "Active" : "Disconnected"} tone={tallyStatus.connectorConnected ? "text-[#16A34A]" : "text-[#DC2626]"} />
          <StatMini label="Tally" value={tallyStatus.tallyConnected ? `Connected — ${tallyStatus.tallyCompany || "Company"}` : "Not detected"} tone={tallyStatus.tallyConnected ? "text-[#16A34A]" : "text-[#D97706]"} />
          <StatMini label="Last heartbeat" value={tallyStatus.lastSeen ? formatDate(tallyStatus.lastSeen) : "Never"} tone="text-[#111827]" />
          <StatMini label="Device ID" value={form.deviceId || "Pending"} tone="text-[#111827]" />
        </div>
      </SettingsCard>

      <SettingsCard title="Tally Connection">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Server IP">
            <input value={form.host} onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))} className="settings-input" />
          </Field>
          <Field label="Port">
            <input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} className="settings-input" />
          </Field>
          <Field label="Company Name">
            <input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} className="settings-input" />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outlinePurple" onClick={onTestConnection} disabled={busy === "test-connection"}>
            {testConnectionResult === "Connected" ? <Check className="h-4 w-4" /> : null}
            Test Connection
          </Button>
          {testConnectionResult ? <span className={cn("text-sm", testConnectionResult === "Connected" ? "text-[#16A34A]" : "text-[#DC2626]")}>{testConnectionResult}</span> : null}
        </div>
      </SettingsCard>

      <SettingsCard title="API Configuration">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Anthropic API Key">
            <div className="flex items-center gap-2">
              <input
                type={form.showApiKey ? "text" : "password"}
                value={form.anthropicApiKey}
                onChange={(event) => setForm((current) => ({ ...current, anthropicApiKey: event.target.value }))}
                className="settings-input flex-1"
                placeholder="Server-managed key"
              />
            <Button variant="ghost" onClick={() => setForm((current) => ({ ...current, showApiKey: !current.showApiKey }))}>
                {form.showApiKey ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>
          <div className="md:self-end">
            <Button variant="outlinePurple" onClick={onTestAI}>
              Test AI
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <div className="glass-panel rounded-[28px] border border-white/70 shadow-panel">
      <div className="border-b border-white/50 px-5 py-4 text-lg font-semibold text-[#111827]">{title}</div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-[#374151]">{label}</div>
      {children}
    </label>
  );
}

function StatMini({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <div className="text-[13px] text-[#6B7280]">{label}</div>
      <div className={cn("mt-2 text-xl font-semibold", tone)}>{value}</div>
    </div>
  );
}

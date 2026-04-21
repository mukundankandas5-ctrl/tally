import { Suspense, lazy, useMemo, useState, useEffect, useRef } from "react";
import ConfidenceBadge from "./ConfidenceBadge";
import MLConfidenceScore from "./MLConfidenceScore";
import QuickCorrectionPanel from "./QuickCorrectionPanel";
import AnomalyWarningBadge from "./AnomalyWarningBadge";
import ProgressiveMLClassifier from "./ProgressiveMLClassifier";
import FileDropzone from "./FileDropzone";
import SectionCard from "./SectionCard";
import StatCard from "./StatCard";

import { downloadBlob } from "../utils/download";
import {
  exportBankStatement,
  learnBankStatement,
  reviseBankStatement,
  uploadBankStatement,
  saveBankStatementAnalysis,
  listBankStatementAnalyses,
  getStatementChangeHistory,
  recordStatementChange,
  undoStatementChange,
  getBankStatementAnalysis,
  deleteBankStatementAnalysis,
  detectDuplicates,
  getDuplicates,
  validateForExport,
  getValidations,
  saveAccountMapping,
  getAccountMappings,
  deleteAccountMapping,
  recordMetric,
  getStatementMetrics,
  getAnalytics,
  startReconciliation,
  verifyReconciliation,
  getReconciliation,
  assignUserToAnalysis,
  getAnalysisAssignees,
  recordAuditLog,
  getAuditLogs,
} from "../utils/api";
import { formatCurrency, formatDate } from "../utils/formatters";

const DuplicateDetectionPanel = lazy(() => import("./DuplicateDetectionPanel"));
const ExportValidationPanel = lazy(() => import("./ExportValidationPanel"));
const AccountMapperDashboard = lazy(() => import("./AccountMapperDashboard"));
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard"));
const ReconciliationTracker = lazy(() => import("./ReconciliationTracker"));
const UserAssignmentPanel = lazy(() => import("./UserAssignmentPanel"));
const RuleDashboard = lazy(() => import("./RuleDashboard"));

function buildDerivedSummary(statement) {
  const transactions = statement.transactions || [];
  const totalDebits = transactions.reduce((sum, transaction) => sum + Number(transaction.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, transaction) => sum + Number(transaction.credit || 0), 0);
  const reviewCount = transactions.filter((transaction) => transaction.needsReview || transaction.confidence === "low").length;

  return {
    periodStart: statement.summary?.periodStart || "",
    periodEnd: statement.summary?.periodEnd || "",
    totalDebits,
    totalCredits,
    transactionCount: transactions.length,
    reviewCount,
  };
}

function getLedgerOptions(ledgerHeads, currentValue) {
  const options = ledgerHeads.map((ledger) => ledger.name);
  if (currentValue && !options.includes(currentValue)) {
    return [currentValue, ...options];
  }
  return options;
}

function getAccountOptions(ledgerHeads, statement, currentValue) {
  const options = new Set(ledgerHeads.map((ledger) => ledger.name));
  options.add(statement?.tallyConfig?.bankLedgerName || "Bank Account");
  (statement?.transactions || []).forEach((transaction) => {
    if (transaction.debitAccount) options.add(transaction.debitAccount);
    if (transaction.creditAccount) options.add(transaction.creditAccount);
    if (transaction.ledgerHead) options.add(transaction.ledgerHead);
  });
  if (currentValue) {
    options.add(currentValue);
  }
  return Array.from(options).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function getTopAccounts(transactions, field) {
  const counts = {};
  (transactions || []).forEach((transaction) => {
    const key = transaction[field];
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
}

export default function BankStatementWorkflow({ ledgerHeads, initialState }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [statement, setStatement] = useState(initialState);
  const [analysisId, setAnalysisId] = useState(initialState?.analysisId || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [changeHistory, setChangeHistory] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState(
    "For UPI transactions, classify people as UPI Transfer and classify businesses by the most suitable business ledger."
  );
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const previousStatementRef = useRef(null);

  // ML Classification state
  const [showMLClassifier, setShowMLClassifier] = useState(false);
  const [mlEnhancedTransactions, setMlEnhancedTransactions] = useState({});

  // Advanced filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    confidenceMin: 0,
    confidenceMax: 100,
    ledger: "",
    voucherType: "",
    amountMin: "",
    amountMax: "",
    dateStart: "",
    dateEnd: "",
    learningSource: "",
    hasFlags: "any",
    needsReview: "any",
  });

  // Bulk selection state
  const [selectedTransactionIds, setSelectedTransactionIds] = useState(new Set());
  const [bulkActionField, setBulkActionField] = useState("");
  const [bulkActionValue, setBulkActionValue] = useState("");

  // Phase 4: Advanced Features State
  const [showPhase4Features, setShowPhase4Features] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [accountMappings, setAccountMappings] = useState([]);
  const [currentUserAssignments, setCurrentUserAssignments] = useState([]);

  // Load saved analyses on mount
  useEffect(() => {
    const loadSavedAnalyses = async () => {
      try {
        const result = await listBankStatementAnalyses(null, 20);
        if (result.success) {
          setSavedAnalyses(result.analyses || []);
        }
      } catch (err) {
        console.error("Failed to load saved analyses:", err);
      }
    };
    loadSavedAnalyses();
  }, []);

  // Load change history when analysis changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!analysisId) {
        setChangeHistory([]);
        setCanUndo(false);
        return;
      }
      try {
        const result = await getStatementChangeHistory(analysisId, 50);
        if (result.success) {
          setChangeHistory(result.history || []);
          setCanUndo((result.history || []).length > 0);
        }
      } catch (err) {
        console.error("Failed to load change history:", err);
      }
    };
    loadHistory();
  }, [analysisId]);

  // Auto-save the statement after analysis is complete
  useEffect(() => {
    const doAutoSave = async () => {
      if (!statement || !statement.transactions || statement.transactions.length === 0 || isSaving) {
        return;
      }
      // Only auto-save if statement has changed and we have the data
      if (previousStatementRef.current && JSON.stringify(previousStatementRef.current) === JSON.stringify(statement)) {
        return;
      }
      
      try {
        setIsSaving(true);
        const result = await saveBankStatementAnalysis(statement, analysisId);
        if (result.success && !analysisId) {
          setAnalysisId(result.id);
        }
        previousStatementRef.current = statement;
      } catch (err) {
        console.error("Failed to auto-save statement:", err);
      } finally {
        setIsSaving(false);
      }
    };

    // Debounce auto-save to avoid too many requests
    const autoSaveTimer = setTimeout(doAutoSave, 2000);
    return () => clearTimeout(autoSaveTimer);
  }, [statement, analysisId, isSaving]);

  const summary = useMemo(() => buildDerivedSummary(statement), [statement]);

  const filteredTransactions = useMemo(() => {
    const transactions = statement.transactions || [];
    
    return transactions.filter((transaction) => {
      // Confidence filter
      const confidence = Number(transaction.confidence || 0);
      if (confidence < filters.confidenceMin || confidence > filters.confidenceMax) {
        return false;
      }

      // Ledger filter
      if (filters.ledger && transaction.ledger !== filters.ledger) {
        return false;
      }

      // Voucher type filter
      if (filters.voucherType && transaction.voucherType !== filters.voucherType) {
        return false;
      }

      // Amount range filter
      const debit = Number(transaction.debit || 0);
      const credit = Number(transaction.credit || 0);
      const amount = debit > 0 ? debit : credit;
      
      if (filters.amountMin && amount < Number(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && amount > Number(filters.amountMax)) {
        return false;
      }

      // Date range filter
      if (filters.dateStart && transaction.date < filters.dateStart) {
        return false;
      }
      if (filters.dateEnd && transaction.date > filters.dateEnd) {
        return false;
      }

      // Learning source filter
      if (filters.learningSource) {
        const hasLearningSource = Boolean(transaction.learningSource);
        if (filters.learningSource === "learned" && !hasLearningSource) {
          return false;
        }
        if (filters.learningSource === "manual" && hasLearningSource) {
          return false;
        }
      }

      // Flags filter
      if (filters.hasFlags !== "any") {
        const flags = transaction.flags || [];
        const hasFlags = Array.isArray(flags) && flags.length > 0;
        if (filters.hasFlags === "with" && !hasFlags) {
          return false;
        }
        if (filters.hasFlags === "without" && hasFlags) {
          return false;
        }
      }

      // Needs review filter
      if (filters.needsReview !== "any") {
        const needsReview = transaction.needsReview || transaction.confidence === "low";
        if (filters.needsReview === "yes" && !needsReview) {
          return false;
        }
        if (filters.needsReview === "no" && needsReview) {
          return false;
        }
      }

      return true;
    });
  }, [statement.transactions, filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.confidenceMin > 0 ||
      filters.confidenceMax < 100 ||
      filters.ledger ||
      filters.voucherType ||
      filters.amountMin ||
      filters.amountMax ||
      filters.dateStart ||
      filters.dateEnd ||
      filters.learningSource ||
      filters.hasFlags !== "any" ||
      filters.needsReview !== "any"
    );
  }, [filters]);

  const ledgerOptions = useMemo(() => {
    const ledgers = new Set(statement.transactions?.map((t) => t.ledger).filter(Boolean) || []);
    return Array.from(ledgers).sort();
  }, [statement.transactions]);

  const voucherTypes = useMemo(() => {
    const types = new Set(statement.transactions?.map((t) => t.voucherType).filter(Boolean) || []);
    return Array.from(types).sort();
  }, [statement.transactions]);

  const topDebitAccounts = useMemo(() => getTopAccounts(statement.transactions, "debitAccount"), [statement.transactions]);
  const topCreditAccounts = useMemo(() => getTopAccounts(statement.transactions, "creditAccount"), [statement.transactions]);

  const statCards = [
    { label: "Period", value: summary.periodStart ? `${formatDate(summary.periodStart)} to ${formatDate(summary.periodEnd)}` : "Not detected", tone: "default" },
    { label: "Total Debits", value: formatCurrency(summary.totalDebits), tone: "amber" },
    { label: "Total Credits", value: formatCurrency(summary.totalCredits), tone: "teal" },
    { label: "Need Review", value: String(summary.reviewCount), tone: summary.reviewCount > 0 ? "rose" : "teal", caption: `${summary.transactionCount} transactions parsed` },
  ];

  const handleMLClassificationComplete = (classifiedTransactions) => {
    // Map the classified transactions by ID for quick lookup
    const mlMap = {};
    classifiedTransactions.forEach((tx) => {
      mlMap[tx.id] = {
        mlConfidence: tx.mlConfidence || 0,
        mlCategory: tx.result?.category || tx.category,
        mlVoucherType: tx.result?.voucherType || tx.voucherType,
        anomalies: tx.anomalies || [],
        riskScore: tx.riskScore || 0,
        confidenceBreakdown: tx.confidenceBreakdown,
      };
    });

    setMlEnhancedTransactions(mlMap);

    // Optionally merge ML results into statement
    setStatement((current) => ({
      ...current,
      transactions: current.transactions.map((tx) => {
        const mlData = mlMap[tx.id];
        if (mlData) {
          return {
            ...tx,
            mlConfidence: mlData.mlConfidence,
            mlCategory: mlData.mlCategory,
            mlVoucherType: mlData.mlVoucherType,
            anomalies: mlData.anomalies,
            riskScore: mlData.riskScore,
            confidenceBreakdown: mlData.confidenceBreakdown,
          };
        }
        return tx;
      }),
    }));

    setShowMLClassifier(false);
    setSuccessMessage(
      `✓ ML classification complete! ${classifiedTransactions.filter((t) => t.mlConfidence > 0.8).length} transactions have high confidence.`
    );
  };

  const handleTransactionCorrected = (transactionId, correctedData) => {
    updateTransaction(transactionId, "ledger", correctedData.ledger);
    updateTransaction(transactionId, "voucherType", correctedData.voucherType);
    
    // Update ML map to reflect the correction
    setMlEnhancedTransactions((current) => ({
      ...current,
      [transactionId]: {
        ...current[transactionId],
        mlCategory: correctedData.ledger,
        mlVoucherType: correctedData.voucherType,
      },
    }));
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError("Choose a bank statement PDF before analyzing.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setIsUploading(true);
      const payload = await uploadBankStatement(selectedFile, assistantPrompt);
      setStatement(payload);
      
      // Trigger ML classification
      setShowMLClassifier(true);
      
      // Auto-save the new analysis
      setTimeout(async () => {
        try {
          const saveResult = await saveBankStatementAnalysis(payload);
          if (saveResult.success) {
            setAnalysisId(saveResult.id);
            setSuccessMessage("Bank statement analyzed and saved successfully. ML classification is running...");
            // Reload saved analyses
            const listResult = await listBankStatementAnalyses(null, 20);
            if (listResult.success) {
              setSavedAnalyses(listResult.analyses || []);
            }
          }
        } catch (saveErr) {
          console.error("Failed to save analysis:", saveErr);
          setError("Analysis completed but failed to save. Refresh to avoid losing data.");
        }
      }, 500);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };



    const updateTransaction = (transactionId, field, value) => {
      const originalTransaction = statement.transactions.find((t) => t.id === transactionId);
      const originalValue = originalTransaction?.[field];

      setStatement((current) => ({
        ...current,
        transactions: current.transactions.map((transaction) =>
          transaction.id === transactionId
            ? (() => {
                const nextTransaction = {
                  ...transaction,
                  [field]:
                    field === "needsReview"
                      ? Boolean(value)
                      : field === "debit" || field === "credit" || field === "balance"
                        ? Number(value || 0)
                        : value,
                };

                if (field === "debit" && Number(value || 0) > 0 && Number(nextTransaction.credit || 0) > 0) {
                  nextTransaction.credit = 0;
                }

                if (field === "credit" && Number(value || 0) > 0 && Number(nextTransaction.debit || 0) > 0) {
                  nextTransaction.debit = 0;
                }

                return nextTransaction;
              })()
            : transaction
        ),
      }));

      // Record change for undo functionality
      if (analysisId && originalValue !== value) {
        recordStatementChange(
          analysisId,
          "transaction_field_update",
          { transactionId, field, value: originalValue },
          { transactionId, field, value },
          `Updated ${field} for transaction ${transactionId}`
        ).catch((err) => console.error("Failed to record change:", err));
      }
    };

  const updateConfigField = (field, value) => {
    setStatement((current) => ({
      ...current,
      tallyConfig: {
        ...current.tallyConfig,
        [field]: value,
      },
    }));
  };

  const handleExport = async () => {
      try {
        setError("");
        setSuccessMessage("");
        setIsExporting(true);
      const blob = await exportBankStatement({
        ...statement,
        summary,
      });
      downloadBlob(blob, "bank-statement-vouchers.xml");
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAiRevision = async () => {
    if (!assistantPrompt.trim()) {
      setError("Add a short instruction for the AI assistant before applying changes.");
      return;
    }

      try {
        setError("");
        setSuccessMessage("");
        setIsRevising(true);
      const payload = await reviseBankStatement(
        {
          ...statement,
          summary,
        },
        assistantPrompt
      );
        setStatement(payload);
        setSuccessMessage("AI changes applied to the current bank statement review.");
      } catch (revisionError) {
      setError(revisionError.message);
    } finally {
      setIsRevising(false);
    }
  };

  const handleLearnFromReview = async () => {
    try {
      setError("");
      setSuccessMessage("");
      setIsLearning(true);
      const result = await learnBankStatement(
        {
          ...statement,
          summary,
        },
        assistantPrompt
      );
      setStatement((current) => ({
        ...current,
        learningSummary: {
          ...(current.learningSummary || {}),
          learnedRuleCount: result.learnedRuleCount,
        },
      }));
      setSuccessMessage(`Learned ${result.learnedRuleCount} recurring mapping rule(s) from your review.`);
    } catch (learningError) {
      setError(learningError.message);
    } finally {
      setIsLearning(false);
    }
  };

  const handleUndoChanges = async () => {
    if (!analysisId || !canUndo) {
      setError("No changes to undo.");
      return;
    }

    try {
      setError("");
      const result = await undoStatementChange(analysisId);
      if (result.success && result.undoData) {
        const previousState = result.undoData.previousState;
        if (previousState && previousState.transactionId) {
          // Undo a transaction field update
          const transactionId = previousState.transactionId;
          const field = previousState.field;
          const value = previousState.value;
          
          setStatement((current) => ({
            ...current,
            transactions: current.transactions.map((t) =>
              t.id === transactionId ? { ...t, [field]: value } : t
            ),
          }));
        }
        setSuccessMessage(`Undone: ${result.undoData.changeSummary}`);
        // Reload history
        const historyResult = await getStatementChangeHistory(analysisId, 50);
        if (historyResult.success) {
          setChangeHistory(historyResult.history || []);
          setCanUndo((historyResult.history || []).length > 0);
        }
      }
    } catch (err) {
      setError(`Failed to undo changes: ${err.message}`);
    }
  };

  const handleLoadAnalysis = async (id) => {
    try {
      setError("");
      const result = await getBankStatementAnalysis(id);
      if (result.success) {
        setStatement(result.statementData);
        setAnalysisId(id);
        setSavedAnalyses((current) =>
          current.map((analysis) =>
            analysis.id === id ? { ...analysis, selectedAt: new Date().toISOString() } : analysis
          )
        );
        setSuccessMessage("Previous analysis loaded successfully.");
        setShowHistory(false);
      }
    } catch (err) {
      setError(`Failed to load analysis: ${err.message}`);
    }
  };

  const handleDeleteAnalysis = async (id) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) {
      return;
    }

    try {
      await deleteBankStatementAnalysis(id);
      setSavedAnalyses((current) => current.filter((a) => a.id !== id));
      if (analysisId === id) {
        setAnalysisId(null);
        setStatement({
          transactions: [],
          tallyConfig: {},
          summary: {},
        });
      }
      setSuccessMessage("Analysis deleted successfully.");
    } catch (err) {
      setError(`Failed to delete analysis: ${err.message}`);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((current) => ({
      ...current,
      [filterName]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      confidenceMin: 0,
      confidenceMax: 100,
      ledger: "",
      voucherType: "",
      amountMin: "",
      amountMax: "",
      dateStart: "",
      dateEnd: "",
      learningSource: "",
      hasFlags: "any",
      needsReview: "any",
    });
  };

  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactionIds((current) => {
      const newSet = new Set(current);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const applyBulkUpdate = (field, value) => {
    if (selectedTransactionIds.size === 0) {
      setError("No transactions selected.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      
      // Store previous state for undo
      const previousState = statement.transactions.filter((t) => selectedTransactionIds.has(t.id));

      setStatement((current) => ({
        ...current,
        transactions: current.transactions.map((transaction) =>
          selectedTransactionIds.has(transaction.id)
            ? {
                ...transaction,
                [field]: field === "needsReview" ? Boolean(value) : value,
              }
            : transaction
        ),
      }));

      // Record bulk change
      if (analysisId) {
        recordStatementChange(
          analysisId,
          "bulk_field_update",
          { transactionIds: Array.from(selectedTransactionIds), field, count: selectedTransactionIds.size },
          { field, value, count: selectedTransactionIds.size },
          `Updated ${field} for ${selectedTransactionIds.size} transaction(s)`
        ).catch((err) => console.error("Failed to record change:", err));
      }

      setSuccessMessage(`Applied "${value}" to ${selectedTransactionIds.size} transaction(s).`);
      setBulkActionField("");
      setBulkActionValue("");
    } catch (err) {
      setError(`Failed to apply bulk update: ${err.message}`);
    }
  };

  const clearSelection = () => {
    setSelectedTransactionIds(new Set());
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Bank Statement Ledger Mapper"
        subtitle="Upload a monthly bank statement PDF, review ledger classification transaction by transaction, then export Payment, Receipt, and Contra vouchers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isUploading}
              className="rounded-2xl bg-sea px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isUploading ? "Analyzing..." : "Analyze Statement"}
            </button>
            {canUndo && (
              <button
                type="button"
                onClick={handleUndoChanges}
                className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                title="Undo the last change"
              >
                ↶ Undo
              </button>
            )}
            {savedAnalyses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                title="Load a previous analysis"
              >
                📋 History
              </button>
            )}
          </div>
        }
      >
        <FileDropzone
          title="Bank statement upload"
          description="Supports text-based PDF statements from Union Bank, SBI, HDFC, ICICI, Axis, and similar Indian bank formats. Upload a file and click Analyze Statement to begin."
          accept=".pdf"
          selectedFile={selectedFile}
          onFileSelected={setSelectedFile}
          buttonLabel="Upload statement"
        />

        {showHistory && savedAnalyses.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Saved Analyses</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {savedAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition ${
                    analysisId === analysis.id
                      ? "border-teal-300 bg-teal-50"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{analysis.originalFileName}</p>
                    <p className="text-xs text-slate-500">
                      {analysis.summary?.transactionCount || 0} transactions • {new Date(analysis.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadAnalysis(analysis.id)}
                      className="rounded px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnalysis(analysis.id)}
                      className="rounded px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {showMLClassifier && statement?.transactions && statement.transactions.length > 0 ? (
          <div className="mt-4">
            <ProgressiveMLClassifier
              transactions={statement.transactions}
              onClassificationComplete={handleMLClassificationComplete}
              autoStart={true}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <label className="label-base">AI Assistant Instructions</label>
          <textarea
            className="input-base min-h-[120px]"
            placeholder="Example: Treat FD booking as Contra, classify UPI payments to people as UPI Transfer, map hospitals to medical expenses, and leave uncertain rows for review."
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
          />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAiRevision}
              disabled={isRevising}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRevising ? "Applying AI Changes..." : "Apply AI Changes"}
              </button>
              <button
                type="button"
                onClick={handleLearnFromReview}
                disabled={isLearning}
                className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLearning ? "Learning..." : "Learn From Current Review"}
              </button>
              <p className="text-sm text-slate-500">
                The same instructions are also sent during the next bank statement analysis.
              </p>
            </div>
          </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard
          title="Transaction Review"
          subtitle="Edit narration-level mappings, filter to find specific transactions, and finalize the voucher type before exporting."
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  showAdvancedFilters
                    ? "bg-teal-100 text-teal-800 border border-teal-300"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                title="Show/hide advanced filters"
              >
                🔍 {showAdvancedFilters ? "Hide" : "Show"} Filters
              </button>
              {hasActiveFilters && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                    {filteredTransactions.length} / {statement.transactions?.length || 0}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Clear
                  </button>
                </>
              )}
              <ConfidenceBadge confidence={statement.confidence} />
            </div>
          }
        >
          {showAdvancedFilters ? (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Advanced Filters</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Confidence Range */}
                <div>
                  <label className="label-base">Confidence: {filters.confidenceMin}% - {filters.confidenceMax}%</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.confidenceMin}
                      onChange={(e) => handleFilterChange("confidenceMin", Math.min(Number(e.target.value), filters.confidenceMax))}
                      className="w-full"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.confidenceMax}
                      onChange={(e) => handleFilterChange("confidenceMax", Math.max(Number(e.target.value), filters.confidenceMin))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Ledger */}
                <div>
                  <label className="label-base">Ledger</label>
                  <select
                    className="input-base"
                    value={filters.ledger}
                    onChange={(e) => handleFilterChange("ledger", e.target.value)}
                  >
                    <option value="">All ledgers</option>
                    {ledgerOptions.map((ledger) => (
                      <option key={ledger} value={ledger}>
                        {ledger}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voucher Type */}
                <div>
                  <label className="label-base">Voucher Type</label>
                  <select
                    className="input-base"
                    value={filters.voucherType}
                    onChange={(e) => handleFilterChange("voucherType", e.target.value)}
                  >
                    <option value="">All types</option>
                    {voucherTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount Range */}
                <div>
                  <label className="label-base">Amount Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.amountMin}
                      onChange={(e) => handleFilterChange("amountMin", e.target.value)}
                      className="input-base flex-1"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.amountMax}
                      onChange={(e) => handleFilterChange("amountMax", e.target.value)}
                      className="input-base flex-1"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="label-base">Start Date</label>
                  <input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => handleFilterChange("dateStart", e.target.value)}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="label-base">End Date</label>
                  <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => handleFilterChange("dateEnd", e.target.value)}
                    className="input-base"
                  />
                </div>

                {/* Learning Source */}
                <div>
                  <label className="label-base">Learning Source</label>
                  <select
                    className="input-base"
                    value={filters.learningSource}
                    onChange={(e) => handleFilterChange("learningSource", e.target.value)}
                  >
                    <option value="">All sources</option>
                    <option value="learned">Learned rules only</option>
                    <option value="manual">Manual entries only</option>
                  </select>
                </div>

                {/* Flags */}
                <div>
                  <label className="label-base">Flags</label>
                  <select
                    className="input-base"
                    value={filters.hasFlags}
                    onChange={(e) => handleFilterChange("hasFlags", e.target.value)}
                  >
                    <option value="any">Any status</option>
                    <option value="with">Has flags</option>
                    <option value="without">No flags</option>
                  </select>
                </div>

                {/* Needs Review */}
                <div>
                  <label className="label-base">Review Status</label>
                  <select
                    className="input-base"
                    value={filters.needsReview}
                    onChange={(e) => handleFilterChange("needsReview", e.target.value)}
                  >
                    <option value="any">Any status</option>
                    <option value="yes">Needs review</option>
                    <option value="no">Reviewed</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {selectedTransactionIds.size > 0 ? (
            <div className="mb-4 rounded-2xl border border-teal-300 bg-teal-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-teal-900">
                    {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Ledger Quick Update */}
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkActionValue}
                      onChange={(e) => setBulkActionValue(e.target.value)}
                      className="input-base min-w-[150px]"
                      placeholder="Select action..."
                    >
                      <option value="">Bulk actions...</option>
                      <option value="">─ Set Ledger ─</option>
                      {ledgerOptions.map((ledger) => (
                        <option key={`bulk-${ledger}`} value={ledger}>
                          • {ledger}
                        </option>
                      ))}
                      <option value="">─ Set Voucher Type ─</option>
                      {voucherTypes.map((type) => (
                        <option key={`bulk-type-${type}`} value={type}>
                          • {type}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (bulkActionValue) {
                          const field = ledgerOptions.includes(bulkActionValue) ? "ledger" : "voucherType";
                          applyBulkUpdate(field, bulkActionValue);
                        }
                      }}
                      disabled={!bulkActionValue}
                      className="rounded-lg border border-teal-300 bg-teal-100 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>

                  {/* Mark as Reviewed */}
                  <button
                    onClick={() => applyBulkUpdate("needsReview", false)}
                    className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    ✓ Mark Reviewed
                  </button>

                  {/* Clear Selection */}
                  <button
                    onClick={clearSelection}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-head w-12">
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                        onChange={toggleSelectAll}
                        title="Select all filtered transactions"
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="table-head">Date</th>
                    <th className="table-head">Narration</th>
                    <th className="table-head">Debit</th>
                    <th className="table-head">Credit</th>
                    <th className="table-head">Balance</th>
                    <th className="table-head">Ledger</th>
                    <th className="table-head">Debit A/C</th>
                    <th className="table-head">Credit A/C</th>
                    <th className="table-head">Voucher</th>
                    <th className="table-head">Confidence</th>
                    <th className="table-head">ML Score</th>
                    <th className="table-head">Anomalies</th>
                    <th className="table-head">Review</th>
                    <th className="table-head">Actions</th>
                  </tr>
                </thead>
              <tbody>
                  {filteredTransactions.length ? (
                    filteredTransactions.map((transaction) => {
                      const options = getLedgerOptions(ledgerHeads, transaction.ledgerHead);
                      const accountOptions = getAccountOptions(ledgerHeads, statement, transaction.debitAccount || transaction.creditAccount);
                      return (
                        <tr key={transaction.id} className={selectedTransactionIds.has(transaction.id) ? "bg-teal-50" : ""}>
                          <td className="table-cell w-12">
                            <input
                              type="checkbox"
                              checked={selectedTransactionIds.has(transaction.id)}
                              onChange={() => toggleTransactionSelection(transaction.id)}
                              title={`Select transaction ${transaction.id}`}
                              className="cursor-pointer"
                            />
                          </td>
                        <td className="table-cell">
                          <input
                            className="input-base"
                            type="date"
                            value={transaction.date}
                            onChange={(event) => updateTransaction(transaction.id, "date", event.target.value)}
                          />
                        </td>
                          <td className="table-cell">
                            <textarea
                            className="input-base min-w-[180px]"
                              rows="2"
                              value={transaction.narration}
                              onChange={(event) => updateTransaction(transaction.id, "narration", event.target.value)}
                            />
                          </td>
                          <td className="table-cell">
                            <input
                              className="input-base min-w-[110px]"
                              type="number"
                              step="0.01"
                              value={transaction.debit}
                              onChange={(event) => updateTransaction(transaction.id, "debit", event.target.value)}
                            />
                          </td>
                          <td className="table-cell">
                            <input
                              className="input-base min-w-[110px]"
                              type="number"
                              step="0.01"
                              value={transaction.credit}
                              onChange={(event) => updateTransaction(transaction.id, "credit", event.target.value)}
                            />
                          </td>
                          <td className="table-cell">
                            <input
                              className="input-base min-w-[110px]"
                              type="number"
                              step="0.01"
                              value={transaction.balance}
                              onChange={(event) => updateTransaction(transaction.id, "balance", event.target.value)}
                            />
                          </td>
                          <td className="table-cell">
                            <select
                              className="input-base min-w-[160px]"
                            value={transaction.ledgerHead}
                            onChange={(event) => updateTransaction(transaction.id, "ledgerHead", event.target.value)}
                          >
                            <option value="">Select ledger</option>
                            {options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                            </select>
                          </td>
                          <td className="table-cell">
                            <select
                              className="input-base min-w-[150px]"
                              value={transaction.debitAccount || ""}
                              onChange={(event) => updateTransaction(transaction.id, "debitAccount", event.target.value)}
                            >
                              <option value="">Select debit A/C</option>
                              {accountOptions.map((option) => (
                                <option key={`debit-${transaction.id}-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="table-cell">
                            <select
                              className="input-base min-w-[150px]"
                              value={transaction.creditAccount || ""}
                              onChange={(event) => updateTransaction(transaction.id, "creditAccount", event.target.value)}
                            >
                              <option value="">Select credit A/C</option>
                              {accountOptions.map((option) => (
                                <option key={`credit-${transaction.id}-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="table-cell">
                            <select
                              className="input-base"
                            value={transaction.voucherType}
                            onChange={(event) => updateTransaction(transaction.id, "voucherType", event.target.value)}
                          >
                            <option value="Payment">Payment</option>
                            <option value="Receipt">Receipt</option>
                            <option value="Contra">Contra</option>
                          </select>
                        </td>
                        <td className="table-cell">
                          <ConfidenceBadge confidence={transaction.confidence} />
                        </td>
                        <td className="table-cell">
                          {mlEnhancedTransactions[transaction.id] ? (
                            <MLConfidenceScore 
                              confidence={mlEnhancedTransactions[transaction.id].mlConfidence}
                              breakdown={mlEnhancedTransactions[transaction.id].confidenceBreakdown}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {mlEnhancedTransactions[transaction.id] ? (
                            <AnomalyWarningBadge 
                              anomalies={mlEnhancedTransactions[transaction.id].anomalies}
                              riskScore={mlEnhancedTransactions[transaction.id].riskScore}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                          <td className="table-cell">
                            <div className="flex flex-col items-center gap-2">
                              <label className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={transaction.needsReview}
                                  onChange={(event) => updateTransaction(transaction.id, "needsReview", event.target.checked)}
                                />
                              </label>
                              {transaction.learningSource ? (
                                <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700">
                                  Learned
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="table-cell">
                            <QuickCorrectionPanel
                              transactionId={transaction.id}
                              currentLedger={transaction.ledger}
                              currentVoucherType={transaction.voucherType}
                              narration={transaction.narration}
                              amount={transaction.debit || transaction.credit}
                              ledgerOptions={ledgerOptions}
                              onCorrected={(correctedData) => handleTransactionCorrected(transaction.id, correctedData)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan="10">
                        {filteredTransactions.length === 0 ? (
                          hasActiveFilters ? (
                            <div>
                              <p>No transactions match the current filters.</p>
                              <button
                                type="button"
                                onClick={handleClearFilters}
                                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 underline"
                              >
                                Clear filters to see all transactions
                              </button>
                            </div>
                          ) : statement.transactions?.length ? (
                            "No transactions loaded. Apply filters to view data."
                          ) : (
                            "Upload a statement to review classified transactions."
                          )
                        ) : null}
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasActiveFilters ? (
            <div className="mt-4 rounded-2xl bg-slate-100 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {filters.confidenceMin > 0 || filters.confidenceMax < 100 ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Confidence: {filters.confidenceMin}%-{filters.confidenceMax}%
                    <button
                      onClick={() => {
                        handleFilterChange("confidenceMin", 0);
                        handleFilterChange("confidenceMax", 100);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.ledger ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Ledger: {filters.ledger}
                    <button
                      onClick={() => handleFilterChange("ledger", "")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.voucherType ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Type: {filters.voucherType}
                    <button
                      onClick={() => handleFilterChange("voucherType", "")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.amountMin || filters.amountMax ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Amount: {filters.amountMin || "0"} - {filters.amountMax || "∞"}
                    <button
                      onClick={() => {
                        handleFilterChange("amountMin", "");
                        handleFilterChange("amountMax", "");
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.dateStart || filters.dateEnd ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Dates: {filters.dateStart || "any"} to {filters.dateEnd || "any"}
                    <button
                      onClick={() => {
                        handleFilterChange("dateStart", "");
                        handleFilterChange("dateEnd", "");
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.learningSource ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Source: {filters.learningSource === "learned" ? "Learned" : "Manual"}
                    <button
                      onClick={() => handleFilterChange("learningSource", "")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.hasFlags !== "any" ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Flags: {filters.hasFlags === "with" ? "Has flags" : "No flags"}
                    <button
                      onClick={() => handleFilterChange("hasFlags", "any")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.needsReview !== "any" ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300">
                    Review: {filters.needsReview === "yes" ? "Needs review" : "Reviewed"}
                    <button
                      onClick={() => handleFilterChange("needsReview", "any")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

        <SectionCard
          title="Tally Export"
          subtitle="Choose the company and bank ledger that should receive the imported vouchers."
          actions={
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-2xl bg-slateblue px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isExporting ? "Preparing XML..." : "Download XML"}
            </button>
          }
          >
            <div className="grid gap-4">
            <div>
              <label className="label-base">Tally Company Name</label>
              <input className="input-base" value={statement.tallyConfig.companyName} onChange={(event) => updateConfigField("companyName", event.target.value)} placeholder="Optional exact company name" />
            </div>
            <div>
              <label className="label-base">Bank Ledger Name</label>
              <input className="input-base" value={statement.tallyConfig.bankLedgerName} onChange={(event) => updateConfigField("bankLedgerName", event.target.value)} />
            </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top Debit A/C</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {topDebitAccounts.length ? (
                    topDebitAccounts.map(([account, count]) => (
                      <p key={account}>
                        {account} <span className="text-slate-400">({count} rows)</span>
                      </p>
                    ))
                  ) : (
                    <p>No debit accounts yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top Credit A/C</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {topCreditAccounts.length ? (
                    topCreditAccounts.map(([account, count]) => (
                      <p key={account}>
                        {account} <span className="text-slate-400">({count} rows)</span>
                      </p>
                    ))
                  ) : (
                    <p>No credit accounts yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-900 p-5 text-sm text-slate-200">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Voucher Mix</div>
            <div className="mt-3 space-y-2">
                <p>Payments: {statement.transactions.filter((transaction) => transaction.voucherType === "Payment").length}</p>
                <p>Receipts: {statement.transactions.filter((transaction) => transaction.voucherType === "Receipt").length}</p>
                <p>Contra: {statement.transactions.filter((transaction) => transaction.voucherType === "Contra").length}</p>
                <p>Learned Rules: {statement.learningSummary?.learnedRuleCount || 0}</p>
              </div>
            </div>

          {statement.reviewNotes?.length ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">AI Review Notes</div>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {statement.reviewNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>

        {/* Phase 4: Advanced Features Section */}
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between px-6">
            <h2 className="text-2xl font-bold text-slate-800">Advanced Features</h2>
            <button
              onClick={() => setShowPhase4Features(!showPhase4Features)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                showPhase4Features
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {showPhase4Features ? "Hide Features" : "Show Features"}
            </button>
          </div>

          {showPhase4Features && (
            <Suspense
              fallback={
                <div className="rounded-3xl border border-white/70 bg-white/65 p-6 text-sm text-slate-600 backdrop-blur-xl">
                  Loading advanced features...
                </div>
              }
            >
              <div className="space-y-6">
                <div className="rounded-3xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm text-slate-700">
                  These tools are optional and loaded only when opened, so your main analysis, review, XML export, and Tally flow stay unaffected.
                </div>

                <DuplicateDetectionPanel
                  analysisId={analysisId}
                  transactions={statement.transactions || []}
                  onDuplicateResolved={() => {
                    // Reload statement if needed
                  }}
                />

                <ExportValidationPanel
                  analysisId={analysisId}
                  transactions={statement.transactions || []}
                  config={statement.tallyConfig}
                  onValidationComplete={(results) => {
                    setValidationResults(results);
                  }}
                />

                <div className="grid gap-6 lg:grid-cols-2">
                  <AccountMapperDashboard
                    clientId={statement.clientId || ""}
                    onMappingChange={() => {
                      // Reload mappings if needed
                    }}
                  />

                  <AnalyticsDashboard
                    clientId={statement.clientId || ""}
                    analysisId={analysisId}
                  />
                </div>

                <ReconciliationTracker
                  analysisId={analysisId}
                  totalTransactions={statement.transactions?.length || 0}
                  totalAmount={
                    (statement.transactions || []).reduce(
                      (sum, t) => sum + (Number(t.debit) || 0) + (Number(t.credit) || 0),
                      0
                    )
                  }
                />

                <div className="grid gap-6 lg:grid-cols-2">
                  <UserAssignmentPanel
                    analysisId={analysisId}
                    currentUser="current_user"
                    onAssignmentChange={() => {
                      // Handle assignment changes
                    }}
                  />

                  <RuleDashboard
                    clientId={statement.clientId || ""}
                    mappingRules={statement.mappingRules || []}
                  />
                </div>
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

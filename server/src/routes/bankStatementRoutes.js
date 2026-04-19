const express = require("express");
const multer = require("multer");
const { analyzeBankStatement, reviseBankStatement } = require("../services/bankStatementService");
const { learnFromStatement } = require("../services/learningService");
const { buildBankStatementXml } = require("../services/tallyXmlService");
const {
  saveBankStatementAnalysis,
  getBankStatementAnalysis,
  listBankStatementAnalyses,
  saveBankStatementChange,
  getStatementChangeHistory,
  deleteBankStatementAnalysis,
  saveDuplicateTransactions,
  getDuplicateTransactions,
  getClientMappingRules,
  saveAccountMapping,
  getAccountMappings,
  deleteAccountMapping,
  saveExportValidation,
  getExportValidations,
  recordMetric,
  getAnalytics,
  saveReconciliation,
  updateReconciliation,
  getReconciliation,
  assignAnalysisToUser,
  getAnalysisAssignees,
  recordAuditLog,
  getAuditLogs,
} = require("../db/database");
const { detectDuplicates } = require("../utils/duplicateDetection");
const { validateBankStatement, getValidationSummary } = require("../utils/exportValidation");
const { calculateStatementMetrics } = require("../utils/analyticsHelper");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

router.post("/analyze", upload.single("file"), async (req, res, next) => {
  try {
    const context = {
      clientId: req.body?.clientId,
      bankName: req.body?.bankName,
      companyName: req.body?.companyName,
      bankLedgerName: req.body?.bankLedgerName,
    };
    const result = await analyzeBankStatement(req.file, req.body?.userInstructions || "", context);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/analyze-bulk", upload.array("files", 12), async (req, res, next) => {
  try {
    const context = {
      clientId: req.body?.clientId,
      bankName: req.body?.bankName,
      companyName: req.body?.companyName,
      bankLedgerName: req.body?.bankLedgerName,
    };
    const files = Array.isArray(req.files) ? req.files : [];
    const jobs = [];

    for (const file of files) {
      try {
        const statement = await analyzeBankStatement(file, req.body?.userInstructions || "", context);
        jobs.push({
          id: `${file.originalname}-${jobs.length + 1}`,
          fileName: file.originalname,
          status: "processed",
          transactionCount: statement.summary?.transactionCount || 0,
          reviewCount: statement.summary?.reviewCount || 0,
          statement,
        });
      } catch (error) {
        jobs.push({
          id: `${file.originalname}-${jobs.length + 1}`,
          fileName: file.originalname,
          status: "failed",
          error: error.message,
        });
      }
    }

    res.json({
      jobs,
      summary: {
        totalFiles: jobs.length,
        processedFiles: jobs.filter((job) => job.status === "processed").length,
        failedFiles: jobs.filter((job) => job.status === "failed").length,
        totalTransactions: jobs.reduce((sum, job) => sum + Number(job.transactionCount || 0), 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/revise", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const result = await reviseBankStatement(req.body?.statement || {}, req.body?.userInstructions || "", {
      clientId: req.body?.statement?.tallyConfig?.clientId,
      bankName: req.body?.statement?.tallyConfig?.bankName,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/export", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const xml = buildBankStatementXml(req.body || {});
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", 'attachment; filename="bank-statement-vouchers.xml"');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

router.post("/learn", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const result = learnFromStatement(req.body?.statement || {}, req.body?.userInstructions || "", {
      clientId: req.body?.statement?.tallyConfig?.clientId,
      bankName: req.body?.statement?.tallyConfig?.bankName,
    });
    res.json({
      message: "Learned mapping rules from the current review.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// New endpoints for persistent storage and undo/redo
router.post("/save", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { id, statement } = req.body;
    const analysisId = id || `analysis-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    
    const clientId = statement?.tallyConfig?.clientId || null;
    const fileName = `statement-${new Date().toISOString().split('T')[0]}-${analysisId.slice(-8)}`;
    const originalFileName = statement?.originalFileName || "bank-statement.pdf";
    
    saveBankStatementAnalysis({
      id: analysisId,
      clientId,
      fileName,
      originalFileName,
      statementData: statement,
      summary: {
        periodStart: statement?.summary?.periodStart,
        periodEnd: statement?.summary?.periodEnd,
        transactionCount: statement?.transactions?.length || 0,
        totalDebits: statement?.transactions?.reduce((sum, t) => sum + Number(t.debit || 0), 0) || 0,
        totalCredits: statement?.transactions?.reduce((sum, t) => sum + Number(t.credit || 0), 0) || 0,
      },
    });
    
    res.json({
      success: true,
      id: analysisId,
      message: "Bank statement analysis saved successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses", async (req, res, next) => {
  try {
    const clientId = req.query.clientId || null;
    const limit = parseInt(req.query.limit || "50", 10);
    
    const analyses = listBankStatementAnalyses(clientId, limit);
    res.json({
      success: true,
      analyses,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id", async (req, res, next) => {
  try {
    const analysis = getBankStatementAnalysis(req.params.id);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Bank statement analysis not found.",
      });
    }
    
    res.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/analyses/:id", async (req, res, next) => {
  try {
    deleteBankStatementAnalysis(req.params.id);
    res.json({
      success: true,
      message: "Bank statement analysis deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id/history", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const history = getStatementChangeHistory(req.params.id, limit);
    
    res.json({
      success: true,
      history,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/analyses/:id/record-change", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { changeType, previousState, newState, changeSummary } = req.body;
    const changeId = `change-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    
    saveBankStatementChange({
      id: changeId,
      analysisId: req.params.id,
      changeType,
      previousState,
      newState,
      changeSummary,
    });
    
    res.json({
      success: true,
      id: changeId,
      message: "Change recorded successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/analyses/:id/undo", async (req, res, next) => {
  try {
    const analysisId = req.params.id;
    const history = getStatementChangeHistory(analysisId, 1);
    
    if (!history || history.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes to undo.",
      });
    }
    
    const lastChange = history[0];
    const analysis = getBankStatementAnalysis(analysisId);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Bank statement analysis not found.",
      });
    }
    
    // Return the previous state so the client can apply it
    res.json({
      success: true,
      message: "Undo information retrieved successfully.",
      undoData: {
        changeId: lastChange.id,
        changeType: lastChange.changeType,
        previousState: lastChange.previousState,
        changeSummary: lastChange.changeSummary,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate Detection Endpoints
router.post("/analyses/:id/detect-duplicates", async (req, res, next) => {
  try {
    const analysis = getBankStatementAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ success: false, message: "Analysis not found" });
    }

    const transactions = analysis.statementData.transactions || [];
    const duplicates = detectDuplicates(transactions).map((duplicate) => ({
      ...duplicate,
      transaction1: transactions.find((transaction) => transaction.id === duplicate.transactionId1) || null,
      transaction2: transactions.find((transaction) => transaction.id === duplicate.transactionId2) || null,
      reason: duplicate.matchReason,
    }));
    
    if (duplicates.length > 0) {
      saveDuplicateTransactions(req.params.id, duplicates);
    }

    res.json({
      success: true,
      duplicateCount: duplicates.length,
      duplicates,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id/duplicates", async (req, res, next) => {
  try {
    const analysis = getBankStatementAnalysis(req.params.id);
    const transactions = analysis?.statementData?.transactions || [];
    const duplicates = getDuplicateTransactions(req.params.id).map((duplicate) => ({
      ...duplicate,
      transaction1: transactions.find((transaction) => transaction.id === duplicate.transactionId1) || null,
      transaction2: transactions.find((transaction) => transaction.id === duplicate.transactionId2) || null,
      reason: duplicate.matchReason,
    }));
    res.json({ success: true, duplicates });
  } catch (error) {
    next(error);
  }
});

// Pre-Export Validation Endpoints
router.post("/analyses/:id/validate-export", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const analysis = getBankStatementAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ success: false, message: "Analysis not found" });
    }

    const ledgerHeads = req.body?.ledgerHeads || [];
    const validationResult = validateBankStatement(analysis.statementData, ledgerHeads);
    const summary = getValidationSummary(validationResult);

    saveExportValidation({
      analysisId: req.params.id,
      validationType: "pre_export",
      status: validationResult.isValid ? "valid" : "invalid",
      issueCount: validationResult.summary.totalIssues,
      issues: validationResult.issues,
    });

    res.json({
      success: true,
      ...summary,
      details: validationResult,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id/validations", async (req, res, next) => {
  try {
    const validations = getExportValidations(req.params.id);
    res.json({ success: true, validations });
  } catch (error) {
    next(error);
  }
});

// Account Mapping Endpoints
router.post("/account-mappings", express.json(), async (req, res, next) => {
  try {
    const { clientId, debitAccount, creditAccount, frequency, confidenceScore } = req.body;
    
    saveAccountMapping({
      clientId,
      debitAccount,
      creditAccount,
      frequency,
      confidenceScore,
    });

    res.json({
      success: true,
      message: "Account mapping saved successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/account-mappings", async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    if (!clientId) {
      return res.status(400).json({ success: false, message: "clientId required" });
    }

    const mappings = getAccountMappings(clientId).map((mapping) => ({
      id: mapping.id,
      clientId: mapping.client_id,
      debitAccount: mapping.debit_account,
      creditAccount: mapping.credit_account,
      frequency: Number(mapping.frequency || 1),
      confidence: Number(mapping.confidence_score || 0),
      confidenceScore: Number(mapping.confidence_score || 0),
      createdAt: mapping.created_at,
      updatedAt: mapping.updated_at,
    }));
    res.json({ success: true, mappings });
  } catch (error) {
    next(error);
  }
});

router.delete("/account-mappings/:id", async (req, res, next) => {
  try {
    deleteAccountMapping(req.params.id);
    res.json({ success: true, message: "Account mapping deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/mapping-rules", async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    if (!clientId) {
      return res.status(400).json({ success: false, message: "clientId required" });
    }

    const rules = getClientMappingRules(clientId).map((rule) => ({
      id: rule.id,
      pattern: rule.pattern || rule.condition_text || "",
      category: rule.category,
      ledger: rule.ledger,
      voucherType: rule.voucher_type,
      source: rule.source === "user_correction" ? "learned" : rule.source,
      confidence: Number(rule.confidence_score || 0),
      usageCount: Number(rule.use_count || 0),
      enabled: Number(rule.active ?? 1) === 1,
      lastUsed: rule.updated_at,
      createdAt: rule.created_at,
      description: `${rule.category} -> ${rule.ledger}`,
      debitAccount: rule.category,
      creditAccount: rule.ledger,
    }));

    res.json({ success: true, rules });
  } catch (error) {
    next(error);
  }
});

// Analytics Endpoints
router.post("/analytics/record-metric", express.json(), async (req, res, next) => {
  try {
    const { clientId, analysisId, metricType, metricValue, metricLabel } = req.body;
    
    recordMetric(clientId, analysisId, metricType, metricValue, metricLabel);
    
    res.json({ success: true, message: "Metric recorded" });
  } catch (error) {
    next(error);
  }
});

router.post("/analytics/statement-metrics", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { statement, clientId, analysisId } = req.body;
    const metrics = calculateStatementMetrics(statement);

    // Record key metrics
    recordMetric(clientId, analysisId, "avg_confidence", metrics.confidence.average, "Confidence Score");
    recordMetric(clientId, analysisId, "transaction_count", metrics.totals.transactions, "Transaction Count");
    recordMetric(clientId, analysisId, "review_required", metrics.status.needsReview, "Flagged for Review");

    res.json({ success: true, metrics });
  } catch (error) {
    next(error);
  }
});

router.get("/analytics", async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    const days = parseInt(req.query.days || "30", 10);

    if (!clientId) {
      return res.status(400).json({ success: false, message: "clientId required" });
    }

    const analytics = getAnalytics(clientId, days);
    res.json({ success: true, analytics, period: `${days} days` });
  } catch (error) {
    next(error);
  }
});

// Reconciliation Endpoints
router.post("/reconciliation/start", express.json(), async (req, res, next) => {
  try {
    const { analysisId, clientId, expectedCount, xmlHash } = req.body;
    
    const pushDate = new Date().toISOString();
    saveReconciliation({
      analysisId,
      clientId,
      pushDate,
      xmlHash,
      expectedCount,
      status: "pending",
    });

    res.json({
      success: true,
      message: "Reconciliation tracking started",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reconciliation/:analysisId/verify", express.json(), async (req, res, next) => {
  try {
    const { receivedCount, matchedEntries, mismatches } = req.body;
    const recon = getReconciliation(req.params.analysisId);

    if (!recon) {
      return res.status(404).json({ success: false, message: "Reconciliation not found" });
    }

    const status = matchedEntries === recon.expectedCount ? "verified" : "partial";
    
    updateReconciliation(recon.id, {
      receivedCount,
      matchedEntries,
      status,
      mismatches,
    });

    const updatedRecon = getReconciliation(req.params.analysisId);
    res.json({
      success: true,
      message: `Reconciliation ${status}`,
      reconciliation: updatedRecon,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reconciliation/:analysisId", async (req, res, next) => {
  try {
    const recon = getReconciliation(req.params.analysisId);
    res.json({
      success: true,
      reconciliation: recon,
    });
  } catch (error) {
    next(error);
  }
});

// User Assignment Endpoints
router.post("/analyses/:id/assign-user", express.json(), async (req, res, next) => {
  try {
    const { userId, assignedBy } = req.body;
    
    assignAnalysisToUser(req.params.id, userId, assignedBy);

    res.json({
      success: true,
      message: "User assigned to analysis",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id/assignees", async (req, res, next) => {
  try {
    const assignees = getAnalysisAssignees(req.params.id).map((assignee) => ({
      id: assignee.id,
      analysisId: assignee.analysis_id,
      userId: assignee.user_id,
      assignedBy: assignee.assigned_by,
      assignedAt: assignee.created_at,
      status: assignee.status,
      name: assignee.name,
      email: assignee.email,
    }));
    res.json({ success: true, assignees });
  } catch (error) {
    next(error);
  }
});

// Audit Log Endpoints
router.post("/analyses/:id/audit-log", express.json(), async (req, res, next) => {
  try {
    const { userId, action, changes, ipAddress } = req.body;
    
    recordAuditLog(req.params.id, userId, action, changes, ipAddress);

    res.json({ success: true, message: "Audit logged" });
  } catch (error) {
    next(error);
  }
});

router.get("/analyses/:id/audit-logs", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const logs = getAuditLogs(req.params.id, limit).map((log) => ({
      id: log.id,
      analysisId: log.analysis_id,
      userId: log.user_id,
      action: log.action,
      changes: log.changes ? JSON.parse(log.changes) : null,
      ipAddress: log.ip_address,
      createdAt: log.created_at,
    }));
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

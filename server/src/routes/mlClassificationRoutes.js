const express = require("express");
const { MLClassificationService } = require("../services/mlClassificationService");
const AnomalyDetectionEngine = require("../services/anomalyDetectionService");
const { classifyTransaction } = require("../utils/classifyTransaction");
const { normaliseNarration } = require("../utils/normaliseNarration");

const router = express.Router();
const mlService = new MLClassificationService();
const anomalyDetector = new AnomalyDetectionEngine();

/**
 * ML-Enhanced Transaction Classification
 * Combines pattern recognition, confidence scoring, ensemble methods, and anomaly detection
 */

/**
 * POST /api/ml-classify/single
 * Classify a single transaction with ML algorithms
 */
router.post("/single", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const { transaction, learnedRules = [], userHistory = [] } = req.body;

    if (!transaction) {
      return res.status(400).json({ error: "Transaction data required" });
    }

    // Normalize narration
    const normalized = normaliseNarration(transaction.narration);

    // Get Anthropic classification (as baseline)
    let anthropicResult;
    try {
      anthropicResult = await classifyTransaction(normalized, learnedRules, "");
    } catch (e) {
      console.warn("Anthropic classification failed:", e.message);
    }

    // ML Classification with all algorithms
    const mlClassification = mlService.classify(
      {
        ...transaction,
        narration: normalized.cleaned,
      },
      {
        learnedRules,
        anthropicResult,
        isRecurring: this.isRecurringPattern(transaction.narration, userHistory),
      }
    );

    // Anomaly Detection
    const anomalies = anomalyDetector.detectAnomalies(transaction, userHistory || []);

    return res.json({
      success: true,
      classification: mlClassification,
      anomalies,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/batch
 * Classify multiple transactions with ML algorithms
 */
router.post("/batch", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { transactions = [], learnedRules = [], userHistory = [] } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "Transactions array required" });
    }

    const results = transactions.map((transaction, index) => {
      try {
        const normalized = normaliseNarration(transaction.narration);

        // ML Classification
        const mlClassification = mlService.classify(
          {
            ...transaction,
            narration: normalized.cleaned,
          },
          {
            learnedRules,
            anthropicResult: null,
          }
        );

        // Anomaly Detection
        const anomalies = anomalyDetector.detectAnomalies(transaction, userHistory || []);

        return {
          index,
          success: true,
          transaction_id: transaction.id,
          classification: mlClassification,
          anomalies,
        };
      } catch (error) {
        return {
          index,
          success: false,
          transaction_id: transaction.id,
          error: error.message,
        };
      }
    });

    // Separate successful and failed classifications
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Calculate batch statistics
    const batchStats = {
      totalTransactions: transactions.length,
      successfulClassifications: successful.length,
      failedClassifications: failed.length,
      anomaliesDetected: successful.filter(r => r.anomalies.isAnomalous).length,
      averageConfidence: successful.length > 0
        ? (successful.reduce((sum, r) => sum + (r.classification.confidence || 0), 0) / successful.length).toFixed(2)
        : 0,
    };

    return res.json({
      success: true,
      stats: batchStats,
      classifications: successful,
      errors: failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/feedback
 * Record user feedback to improve ML model accuracy
 */
router.post("/feedback", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const { transaction, suggestedClassification, userCorrection, accuracy } = req.body;

    if (!transaction || !userCorrection) {
      return res.status(400).json({ error: "Transaction and correction data required" });
    }

    const feedback = mlService.recordUserFeedback(
      transaction,
      suggestedClassification || {},
      userCorrection,
      accuracy
    );

    return res.json({
      success: true,
      feedback,
      message: "Feedback recorded and model updated",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/feedback-batch
 * Record feedback for multiple transactions
 */
router.post("/feedback-batch", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { feedbackItems = [] } = req.body;

    if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
      return res.status(400).json({ error: "Feedback items array required" });
    }

    const results = feedbackItems.map((item, index) => {
      try {
        const feedback = mlService.recordUserFeedback(
          item.transaction,
          item.suggestedClassification || {},
          item.userCorrection,
          item.accuracy
        );

        return {
          index,
          success: true,
          feedback,
        };
      } catch (error) {
        return {
          index,
          success: false,
          error: error.message,
        };
      }
    });

    const successful = results.filter(r => r.success);

    return res.json({
      success: true,
      feedbackRecorded: successful.length,
      totalFeedback: feedbackItems.length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ml-classify/metrics
 * Get ML model performance metrics
 */
router.get("/metrics", async (req, res, next) => {
  try {
    const metrics = mlService.getModelMetrics();
    const improvements = mlService.getImprovementSuggestions();

    return res.json({
      success: true,
      metrics,
      improvements,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ml-classify/metrics/category/:category
 * Get metrics for a specific category
 */
router.get("/metrics/category/:category", async (req, res, next) => {
  try {
    const { category } = req.params;
    const allMetrics = mlService.getModelMetrics();

    if (!allMetrics[category]) {
      return res.status(404).json({ error: `No metrics found for category: ${category}` });
    }

    return res.json({
      success: true,
      category,
      metrics: allMetrics[category],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/anomaly-check
 * Check a transaction for anomalies
 */
router.post("/anomaly-check", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const { transaction, userHistory = [] } = req.body;

    if (!transaction) {
      return res.status(400).json({ error: "Transaction data required" });
    }

    const anomalyResult = anomalyDetector.detectAnomalies(transaction, userHistory);

    return res.json({
      success: true,
      anomalies: anomalyResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/optimize-ap
 * Optimize transaction for AP (Accounts Payable) efficiency
 */
router.post("/optimize-ap", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const { transaction, classification } = req.body;

    if (!transaction || !classification) {
      return res.status(400).json({ error: "Transaction and classification required" });
    }

    const optimized = mlService.apOptimizer.optimizeForAP(transaction, classification);

    return res.json({
      success: true,
      optimized,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/confidence-analysis
 * Get detailed confidence scoring analysis
 */
router.post("/confidence-analysis", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const { transaction } = req.body;

    if (!transaction) {
      return res.status(400).json({ error: "Transaction data required" });
    }

    const normalized = normaliseNarration(transaction.narration);
    
    // Get ML classification
    const mlResult = mlService.classify(transaction, {});

    // Detailed confidence factors
    const confidenceFactors = {
      narration: {
        original: transaction.narration,
        normalized: normalized.cleaned,
        clarity: mlService.confidenceEngine.scoreNarrationClarity(normalized.cleaned),
        length: normalized.cleaned.length,
      },
      amount: {
        value: transaction.amount,
        isRoundAmount: mlService.confidenceEngine.isRoundAmount(transaction.amount),
      },
      mode: {
        mode: transaction.mode,
        confidence_boost: mlService.confidenceEngine.calculateModeConfidence(transaction.mode),
      },
      finalConfidence: mlResult.confidence,
    };

    return res.json({
      success: true,
      classification: mlResult,
      confidenceBreakdown: confidenceFactors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ml-classify/improvement-suggestions
 * Get suggestions for improving ML model
 */
router.get("/improvement-suggestions", async (req, res, next) => {
  try {
    const suggestions = mlService.getImprovementSuggestions();

    return res.json({
      success: true,
      suggestions,
      recommendation: suggestions.length > 0
        ? `${suggestions.length} categories need attention for improved accuracy`
        : "Model performing well across all categories",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ml-classify/validate-batch
 * Validate a batch of classifications before export
 */
router.post("/validate-batch", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const { classifications = [] } = req.body;

    if (!Array.isArray(classifications)) {
      return res.status(400).json({ error: "classifications array required" });
    }

    const validation = {
      totalClassifications: classifications.length,
      highConfidence: classifications.filter(c => c.confidence >= 0.85).length,
      mediumConfidence: classifications.filter(c => c.confidence >= 0.70 && c.confidence < 0.85).length,
      lowConfidence: classifications.filter(c => c.confidence < 0.70).length,
      withAnomalies: classifications.filter(c => c.anomalies?.isAnomalous).length,
      readyForExport: classifications.filter(c => c.confidence >= 0.85 && !c.anomalies?.isAnomalous).length,
    };

    const requiresReview = classifications.filter(c => {
      return c.confidence < 0.85 || c.anomalies?.isAnomalous;
    });

    return res.json({
      success: true,
      validationSummary: validation,
      exportReadiness: `${validation.readyForExport}/${validation.totalClassifications} transactions ready for export`,
      requiresReview,
      recommendations: this.generateValidationRecommendations(validation),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Helper methods
router.isRecurringPattern = function(narration, userHistory) {
  const narration_str = String(narration || "").toUpperCase();
  
  // Check if this narration pattern appears multiple times
  if (!Array.isArray(userHistory)) return false;
  
  const matches = userHistory.filter(t => {
    const hist_narration = String(t.narration || "").toUpperCase();
    return hist_narration.includes(narration_str) || narration_str.includes(hist_narration);
  });
  
  return matches.length >= 2;
};

router.generateValidationRecommendations = function(validation) {
  const recommendations = [];

  if (validation.lowConfidence > validation.totalClassifications * 0.1) {
    recommendations.push({
      severity: "high",
      message: "More than 10% of classifications have low confidence - review narration quality",
    });
  }

  if (validation.withAnomalies > 0) {
    recommendations.push({
      severity: "medium",
      message: `${validation.withAnomalies} anomalies detected - manual review recommended`,
    });
  }

  if (validation.readyForExport / validation.totalClassifications < 0.8) {
    recommendations.push({
      severity: "medium",
      message: "Less than 80% ready for export - consider additional review",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: "low",
      message: "Batch looks good for export",
    });
  }

  return recommendations;
};

module.exports = router;

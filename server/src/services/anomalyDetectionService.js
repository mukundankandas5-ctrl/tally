/**
 * Anomaly Detection Engine - ML-based transaction anomaly detection
 * 
 * Identifies suspicious, unusual, or potentially fraudulent patterns in bank transactions
 * Uses statistical analysis and behavioral patterns
 */

const fs = require("fs");
const path = require("path");

class AnomalyDetectionEngine {
  constructor() {
    this.statisticsFile = path.join(__dirname, "../data/transaction-statistics.json");
    this.stats = this.loadStatistics();
    this.anomalyThreshold = 0.75; // Threshold for flagging anomalies
  }

  loadStatistics() {
    try {
      if (fs.existsSync(this.statisticsFile)) {
        return JSON.parse(fs.readFileSync(this.statisticsFile, "utf8"));
      }
    } catch (e) {
      //
    }
    return {
      amountRanges: {},
      frequencyPatterns: {},
      merchantPatterns: {},
      timePatterns: {},
      categoryStats: {},
    };
  }

  saveStatistics() {
    const dataDir = path.dirname(this.statisticsFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(this.statisticsFile, JSON.stringify(this.stats, null, 2), "utf8");
  }

  /**
   * Detect anomalies in a transaction
   */
  detectAnomalies(transaction, userProfileTransactions = []) {
    const anomalies = [];
    const riskScore = 0;

    // Check 1: Amount anomaly
    const amountAnomaly = this.detectAmountAnomaly(transaction, userProfileTransactions);
    if (amountAnomaly.isAnomaly) {
      anomalies.push(amountAnomaly);
    }

    // Check 2: Frequency anomaly
    const frequencyAnomaly = this.detectFrequencyAnomaly(transaction, userProfileTransactions);
    if (frequencyAnomaly.isAnomaly) {
      anomalies.push(frequencyAnomaly);
    }

    // Check 3: Time-based anomaly
    const timeAnomaly = this.detectTimeAnomaly(transaction);
    if (timeAnomaly.isAnomaly) {
      anomalies.push(timeAnomaly);
    }

    // Check 4: Merchant anomaly (if applicable)
    if (this.isMerchantTransaction(transaction)) {
      const merchantAnomaly = this.detectMerchantAnomaly(transaction, userProfileTransactions);
      if (merchantAnomaly.isAnomaly) {
        anomalies.push(merchantAnomaly);
      }
    }

    // Check 5: Pattern breaking
    const patternAnomaly = this.detectPatternBreak(transaction, userProfileTransactions);
    if (patternAnomaly.isAnomaly) {
      anomalies.push(patternAnomaly);
    }

    // Check 6: Velocity check (too many transactions in short time)
    const velocityAnomaly = this.detectVelocity(transaction, userProfileTransactions);
    if (velocityAnomaly.isAnomaly) {
      anomalies.push(velocityAnomaly);
    }

    // Calculate overall anomaly risk
    const overallRisk = anomalies.reduce((sum, a) => sum + a.severity, 0) / (anomalies.length || 1);

    return {
      isAnomalous: anomalies.length > 0 && overallRisk > this.anomalyThreshold,
      anomalies,
      riskScore: Math.round(overallRisk * 100) / 100,
      flags: anomalies.map(a => a.type),
      recommendedAction: this.getRecommendedAction(anomalies),
    };
  }

  /**
   * Check if transaction amount is anomalous
   * Compares against user's typical spending/receiving patterns
   */
  detectAmountAnomaly(transaction, userTransactions) {
    const amount = Math.abs(transaction.amount || 0);
    const category = transaction.suggestedCategory || "unknown";

    // Get similar transactions
    const similar = userTransactions.filter(t => {
      const cat = t.suggestedCategory || t.category || "unknown";
      return cat === category && t.txnType === transaction.txnType;
    });

    if (similar.length < 3) {
      // Not enough data
      return { isAnomaly: false };
    }

    // Calculate statistics
    const amounts = similar.map(t => Math.abs(t.amount || 0));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Z-score calculation
    const zScore = (amount - mean) / (stdDev || 1);
    const isAnomaly = Math.abs(zScore) > 3; // 3 standard deviations

    return {
      isAnomaly,
      type: "amount_anomaly",
      severity: Math.min(1, Math.abs(zScore) / 5),
      details: {
        userAverage: Math.round(mean),
        userStdDev: Math.round(stdDev),
        transactionAmount: amount,
        zScore: Math.round(zScore * 100) / 100,
        expectedRange: `₹${Math.round(mean - 2 * stdDev)} - ₹${Math.round(mean + 2 * stdDev)}`,
      },
      message: `Transaction amount (₹${amount}) is ${isAnomaly ? 'highly' : 'moderately'} unusual for this category`,
    };
  }

  /**
   * Check if transaction frequency is anomalous
   */
  detectFrequencyAnomaly(transaction, userTransactions) {
    const category = transaction.suggestedCategory || "unknown";
    const txnDate = new Date(transaction.date);
    const dayStart = new Date(txnDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(txnDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Count transactions in same category today
    const todayCount = userTransactions.filter(t => {
      const tDate = new Date(t.date);
      const cat = t.suggestedCategory || t.category || "unknown";
      return cat === category &&
        tDate >= dayStart &&
        tDate <= dayEnd &&
        t.txnType === transaction.txnType;
    }).length;

    // Count average per day for this category
    if (userTransactions.length < 10) {
      return { isAnomaly: false };
    }

    const dayRange = (new Date() - new Date(userTransactions[0].date)) / (1000 * 60 * 60 * 24);
    const similar = userTransactions.filter(t => {
      const cat = t.suggestedCategory || t.category || "unknown";
      return cat === category && t.txnType === transaction.txnType;
    });

    const avgPerDay = similar.length / Math.max(dayRange, 1);

    return {
      isAnomaly: todayCount > (avgPerDay * 5),
      type: "frequency_anomaly",
      severity: Math.min(1, (todayCount / (avgPerDay * 2)) - 1),
      details: {
        countToday: todayCount,
        averagePerDay: Math.round(avgPerDay * 100) / 100,
        unexpectedCount: todayCount - Math.ceil(avgPerDay),
      },
      message: `Unusual frequency: ${todayCount} transactions in this category today`,
    };
  }

  /**
   * Check for time-based anomalies
   * Unusual times for transactions
   */
  detectTimeAnomaly(transaction) {
    const txnDate = new Date(transaction.date);
    const hour = txnDate.getHours();
    const day = txnDate.getDay();

    // Flag: Unusual hours (late night or very early morning)
    const isUnusualHour = (hour > 22 || hour < 5);

    // Flag: Unusual days (holidays might be unusual)
    const isWeekend = day === 0 || day === 6;

    const narration = String(transaction.narration || "").toUpperCase();
    
    // Some transactions are expected on weekends (personal spending)
    const isPersonal = /UPI|AMAZON|FLIPKART|SWIGGY|ZOMATO/.test(narration);

    return {
      isAnomaly: isUnusualHour && !isPersonal,
      type: "time_anomaly",
      severity: isUnusualHour ? 0.4 : 0,
      details: {
        hour,
        isWeekend,
        isUnusualHour,
      },
      message: isUnusualHour ? `Transaction at unusual hour (${hour}:00)` : null,
    };
  }

  /**
   * Check if merchant/payee is anomalous
   */
  detectMerchantAnomaly(transaction, userTransactions) {
    const merchant = this.extractMerchant(transaction.narration);
    if (!merchant) {
      return { isAnomaly: false };
    }

    const merchantTxns = userTransactions.filter(t => {
      const m = this.extractMerchant(t.narration);
      return m && m.toLowerCase() === merchant.toLowerCase();
    });

    // New merchant check
    if (merchantTxns.length === 0) {
      return {
        isAnomaly: false, // New merchants aren't necessarily anomalous
        type: "new_merchant",
        severity: 0.2,
        details: { merchant, isNewMerchant: true },
        message: `First transaction with merchant: ${merchant}`,
      };
    }

    // Check amount consistency for this merchant
    const amounts = merchantTxns.map(t => Math.abs(t.amount || 0));
    const maxAmount = Math.max(...amounts);
    const currentAmount = Math.abs(transaction.amount || 0);

    const exceedsMax = currentAmount > maxAmount * 1.5;

    return {
      isAnomaly: exceedsMax,
      type: "merchant_amount_anomaly",
      severity: exceedsMax ? 0.6 : 0,
      details: {
        merchant,
        currentAmount,
        typicalRange: `₹${Math.min(...amounts)} - ₹${maxAmount}`,
        exceeds: currentAmount - maxAmount,
      },
      message: exceedsMax ? `Amount significantly higher than usual for this merchant` : null,
    };
  }

  /**
   * Detect if transaction breaks established patterns
   */
  detectPatternBreak(transaction, userTransactions) {
    const category = transaction.suggestedCategory || "unknown";
    const narration = String(transaction.narration || "").toUpperCase();

    // Get historical pattern for this category
    const categoryTxns = userTransactions.filter(t => {
      const cat = t.suggestedCategory || t.category || "unknown";
      return cat === category;
    });

    if (categoryTxns.length < 5) {
      return { isAnomaly: false };
    }

    // Check if narration pattern is consistent
    const keywords = this.extractKeywords(narration);
    const historicalKeywords = categoryTxns.flatMap(t => this.extractKeywords(String(t.narration || "").toUpperCase()));
    const commonKeywords = keywords.filter(k => historicalKeywords.includes(k));

    const patternMatch = commonKeywords.length / Math.max(keywords.length, 1);

    return {
      isAnomaly: patternMatch < 0.3 && keywords.length > 2,
      type: "pattern_break",
      severity: 1 - patternMatch,
      details: {
        category,
        keywordMatch: Math.round(patternMatch * 100),
        currentKeywords: keywords,
      },
      message: patternMatch < 0.3 ? `Narration pattern differs from typical ${category} transactions` : null,
    };
  }

  /**
   * Check velocity - too many transactions in short time
   */
  detectVelocity(transaction, userTransactions) {
    const txnDate = new Date(transaction.date);
    const oneHourBefore = new Date(txnDate.getTime() - 60 * 60 * 1000);

    const recentTxns = userTransactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= oneHourBefore && tDate <= txnDate;
    });

    // Flag if more than 5 transactions in 1 hour
    const isHighVelocity = recentTxns.length > 5;

    return {
      isAnomaly: isHighVelocity,
      type: "velocity_anomaly",
      severity: Math.min(1, (recentTxns.length - 5) / 10),
      details: {
        transactionsInLastHour: recentTxns.length,
      },
      message: isHighVelocity ? `High velocity: ${recentTxns.length} transactions in last hour` : null,
    };
  }

  // Helper methods
  extractMerchant(narration) {
    const narration_str = String(narration || "").toUpperCase();
    const merchants =["SWIGGY", "ZOMATO", "AMAZON", "FLIPKART", "UBER", "OLA"];
    for (const m of merchants) {
      if (narration_str.includes(m)) return m;
    }
    // Try to extract from pattern
    const match = narration_str.match(/([A-Z\s]{5,}?)(?:\s|$|AT|FOR|TO)/);
    return match ? match[1].trim() : null;
  }

  extractKeywords(narration) {
    return String(narration || "")
      .toUpperCase()
      .match(/\b[A-Z]{3,}\b/g) || [];
  }

  isMerchantTransaction(transaction) {
    const narration = String(transaction.narration || "").toUpperCase();
    return /UPI|SWIGGY|ZOMATO|AMAZON|FLIPKART|UBER|OLA/.test(narration);
  }

  getRecommendedAction(anomalies) {
    if (!anomalies || anomalies.length === 0) {
      return "auto_approve";
    }

    const severities = anomalies.map(a => a.severity);
    const maxSeverity = Math.max(...severities);

    if (maxSeverity > 0.9) {
      return "manual_review_required";
    }
    if (maxSeverity > 0.7) {
      return "review_recommended";
    }
    return "auto_approve_with_flag";
  }

  /**
   * Update statistics based on confirmed transactions
   */
  updateStatistics(transaction, category) {
    if (!this.stats.categoryStats[category]) {
      this.stats.categoryStats[category] = {
        count: 0,
        amounts: [],
        frequency: {},
      };
    }

    const stat = this.stats.categoryStats[category];
    stat.count++;
    stat.amounts.push(transaction.amount);

    // Keep only last 100 amounts per category
    if (stat.amounts.length > 100) {
      stat.amounts = stat.amounts.slice(-100);
    }

    this.saveStatistics();
  }
}

module.exports = AnomalyDetectionEngine;

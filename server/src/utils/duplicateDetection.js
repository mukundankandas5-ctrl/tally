/**
 * Duplicate detection utility for bank statements
 * Detects and flags duplicate transactions based on amount, date, and narration
 */

function calculateNarrationSimilarity(narr1, narr2) {
  if (narr1 === narr2) return 1.0;
  
  const n1 = narr1.toLowerCase().trim();
  const n2 = narr2.toLowerCase().trim();
  
  // Simple edit distance based similarity
  let matches = 0;
  const minLen = Math.min(n1.length, n2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (n1[i] === n2[i]) matches++;
  }
  
  return matches / Math.max(n1.length, n2.length);
}

function detectDuplicates(transactions, toleranceWindow = 2) {
  /**
   * Detects duplicate transactions within a tolerance window (in days)
   * Returns array of duplicate pairs with match scores
   */
  
  if (!Array.isArray(transactions) || transactions.length < 2) {
    return [];
  }

  const duplicates = [];
  const flagged = new Set();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const t1 = transactions[i];
      const t2 = transactions[j];

      // Skip if either is already flagged
      if (flagged.has(t1.id) || flagged.has(t2.id)) continue;

      // Amount must match exactly
      const amount1 = Math.abs(Number(t1.debit || t1.credit || 0));
      const amount2 = Math.abs(Number(t2.debit || t2.credit || 0));
      
      if (amount1 !== amount2 || amount1 === 0) continue;

      // Check date proximity
      const date1 = new Date(t1.date);
      const date2 = new Date(t2.date);
      const dayDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
      
      if (dayDiff > toleranceWindow) continue;

      // Check narration similarity
      const narrationSimilarity = calculateNarrationSimilarity(
        t1.narration || "",
        t2.narration || ""
      );

      // Calculate overall match score
      const dateScore = 1 - (dayDiff / toleranceWindow) * 0.3; // 30% weight on date
      const narrationScore = narrationSimilarity * 0.7; // 70% weight on narration
      const matchScore = dateScore + narrationScore;

      // Flag if match score is high
      if (matchScore >= 0.85) {
        duplicates.push({
          transactionId1: t1.id,
          transactionId2: t2.id,
          matchScore,
          matchReason: `Same amount (₹${amount1}), similar narration (${Math.round(narrationSimilarity * 100)}%), ${Math.round(dayDiff)} days apart`,
        });

        flagged.add(t1.id);
        flagged.add(t2.id);
      }
    }
  }

  return duplicates;
}

function getUniqueTransactions(transactions, duplicates = []) {
  /**
   * Identifies which transactions to keep (one from each duplicate pair)
   * Returns set of transaction IDs to keep
   */
  
  const duplicateIds = new Set();
  const keepIds = new Set();

  if (Array.isArray(duplicates)) {
    for (const dup of duplicates) {
      duplicateIds.add(dup.transactionId1);
      duplicateIds.add(dup.transactionId2);
      // Keep the one with higher confidence or reviewed status
      const t1 = transactions.find((t) => t.id === dup.transactionId1);
      const t2 = transactions.find((t) => t.id === dup.transactionId2);
      
      const t1Score = (t1?.confidence || 0) + (t1?.needsReview ? 0 : 0.5);
      const t2Score = (t2?.confidence || 0) + (t2?.needsReview ? 0 : 0.5);
      
      keepIds.add(t1Score >= t2Score ? dup.transactionId1 : dup.transactionId2);
    }
  }

  // Keep all non-duplicate transactions
  const result = new Set(transactions.map((t) => t.id));
  for (const id of duplicateIds) {
    if (!keepIds.has(id)) {
      result.delete(id);
    }
  }

  return result;
}

module.exports = {
  detectDuplicates,
  getUniqueTransactions,
};

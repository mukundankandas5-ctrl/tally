const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { updateTransactionClassification, upsertMappingRule } = require("../db/database");

const router = express.Router();

router.post("/transactions/:id/correct", requireAuth, express.json({ limit: "2mb" }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const transactionId = String(id || "").trim();
    const category = String(req.body?.category || "").trim();
    const ledger = String(req.body?.ledger || "").trim();
    const voucherType = String(req.body?.voucher_type || req.body?.voucherType || "").trim();
    const narration = String(req.body?.narration || "").trim();
    const upiVpa = String(req.body?.upiVpa || "").trim();
    const clientId = String(req.body?.clientId || "").trim();

    if (!transactionId || !category || !ledger || !voucherType) {
      return res.status(400).json({
        success: false,
        message: "Transaction id, category, ledger, and voucher type are required for correction.",
      });
    }

    updateTransactionClassification({
      id: transactionId,
      category,
      ledger,
      voucherType,
      reviewedBy: req.auth?.userId || "local-user",
    });

    const pattern = narration.replace(/\d{10,}/g, " ").replace(/\s+/g, " ").trim().substring(0, 40);
    if (clientId && pattern) {
      upsertMappingRule({
        clientId,
        pattern,
        upiVpa: upiVpa || null,
        category,
        ledger,
        voucherType,
        source: "user_correction",
        confidenceScore: 1.0,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

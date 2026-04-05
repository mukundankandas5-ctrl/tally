const express = require("express");
const { ledgerHeads, defaultVoucherLedgers } = require("../constants/ledgerHeads");
const { getTallySyncStatus } = require("../services/tallyConnectionService");

const router = express.Router();

router.get("/ledgers", (req, res) => {
  res.json({
    ledgerHeads,
    defaults: defaultVoucherLedgers,
  });
});

router.get("/clients", (req, res) => {
  res.json({
    clients: [
      { id: "aurora", name: "Aurora Traders LLP", pendingEntries: 18, accuracyScore: 98.4, lastActivity: "2026-04-05T10:15:00.000Z" },
      { id: "bluewave", name: "Bluewave Retail Pvt Ltd", pendingEntries: 6, accuracyScore: 96.9, lastActivity: "2026-04-05T09:10:00.000Z" },
      { id: "greenleaf", name: "Greenleaf Foods", pendingEntries: 11, accuracyScore: 97.6, lastActivity: "2026-04-04T17:45:00.000Z" },
    ],
    tallyStatus: getTallySyncStatus(),
  });
});

module.exports = router;

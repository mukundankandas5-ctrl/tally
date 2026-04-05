const express = require("express");
const { ledgerHeads, defaultVoucherLedgers } = require("../constants/ledgerHeads");

const router = express.Router();

router.get("/ledgers", (req, res) => {
  res.json({
    ledgerHeads,
    defaults: defaultVoucherLedgers,
  });
});

module.exports = router;

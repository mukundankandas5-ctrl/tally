const express = require("express");
const { buildInvoiceXml, buildBankStatementXml } = require("../services/tallyXmlService");
const { pushXmlToTally, testTallyConnection, getTallySyncStatus } = require("../services/tallyConnectionService");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json(getTallySyncStatus());
});

router.post("/test", express.json({ limit: "2mb" }), async (req, res, next) => {
  try {
    const result = await testTallyConnection(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/push-xml", express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const result = await pushXmlToTally(req.body?.config || {}, req.body?.xml || "", req.body?.entryCount || 0);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/push-invoice", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const xml = buildInvoiceXml(req.body?.invoice || {});
    const result = await pushXmlToTally(req.body?.config || req.body?.invoice?.tallyConfig || {}, xml, 1);
    res.json({ ...result, xml });
  } catch (error) {
    next(error);
  }
});

router.post("/push-bank-statement", express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const statement = req.body?.statement || {};
    const xml = buildBankStatementXml(statement);
    const entryCount = Array.isArray(statement.transactions) ? statement.transactions.length : 0;
    const result = await pushXmlToTally(req.body?.config || statement.tallyConfig || {}, xml, entryCount);
    res.json({ ...result, xml });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

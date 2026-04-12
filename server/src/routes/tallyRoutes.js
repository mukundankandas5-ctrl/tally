const express = require("express");
const { buildInvoiceXml, buildBankStatementXml } = require("../services/tallyXmlService");
const { getTallySyncStatus } = require("../services/tallyConnectionService");
const { getDeviceStatusForUser, queuePushToUserDevice } = require("../services/connectorHub");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json(getTallySyncStatus());
});

router.post("/test", requireAuth, (req, res) => {
  res.json({
    ok: true,
    ...getDeviceStatusForUser(req.auth.userId),
  });
});

router.post("/push-xml", requireAuth, express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const options = {
      clientId: req.body?.clientId || req.body?.config?.clientId,
      companyName: req.body?.companyName || req.body?.config?.companyName,
      type: "xml"
    };
    const queued = queuePushToUserDevice(req.auth.userId, req.body?.xml || "", options);
    const result = await queued.promise;
    res.json({ entryId: queued.entryId, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/push-invoice", requireAuth, express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const xml = buildInvoiceXml(req.body?.invoice || {});
    const options = {
      clientId: req.body?.config?.clientId,
      companyName: req.body?.config?.companyName,
      type: "purchase_invoice"
    };
    const queued = queuePushToUserDevice(req.auth.userId, xml, options);
    const result = await queued.promise;
    res.json({ entryId: queued.entryId, ...result, xml });
  } catch (error) {
    next(error);
  }
});

router.post("/push-bank-statement", requireAuth, express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const statement = req.body?.statement || {};
    const xml = buildBankStatementXml(statement);
    const options = {
      clientId: req.body?.config?.clientId,
      companyName: req.body?.config?.companyName,
      type: "bank_statement"
    };
    const queued = queuePushToUserDevice(req.auth.userId, xml, options);
    const result = await queued.promise;
    res.json({ entryId: queued.entryId, ...result, xml });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

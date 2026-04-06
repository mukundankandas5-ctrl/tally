const crypto = require("crypto");
const express = require("express");
const { ledgerHeads, defaultVoucherLedgers } = require("../constants/ledgerHeads");
const { getTallySyncStatus } = require("../services/tallyConnectionService");
const {
  createClient,
  createDocumentRequest,
  listClients,
  listDocumentRequests,
  updateDocumentRequestStatus,
} = require("../db/database");
const AppError = require("../utils/appError");

const router = express.Router();

router.get("/ledgers", (req, res) => {
  res.json({
    ledgerHeads,
    defaults: defaultVoucherLedgers,
  });
});

router.get("/clients", (req, res) => {
  res.json({
    clients: listClients(),
    tallyStatus: getTallySyncStatus(),
  });
});

router.post("/clients", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw new AppError("Enter a client name before creating the client record.", 400);
    }

    const client = createClient({
      id: crypto.randomUUID(),
      name,
      bankName: String(req.body?.bankName || "").trim(),
      tallyCompanyName: String(req.body?.tallyCompanyName || "").trim(),
    });

    res.status(201).json({ client });
  } catch (error) {
    next(error);
  }
});

router.get("/document-requests", (req, res) => {
  res.json({
    requests: listDocumentRequests(),
  });
});

router.post("/document-requests", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const clientId = String(req.body?.clientId || "").trim();
    const clientName = String(req.body?.clientName || "").trim();
    const title = String(req.body?.title || "").trim();

    if (!clientId || !clientName || !title) {
      throw new AppError("Choose a client and provide the requested document details.", 400);
    }

    const request = createDocumentRequest({
      id: crypto.randomUUID(),
      clientId,
      clientName,
      title,
      channel: String(req.body?.channel || "Email").trim(),
      dueDate: String(req.body?.dueDate || "").trim(),
      notes: String(req.body?.notes || "").trim(),
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
});

router.post("/document-requests/:id/complete", (req, res, next) => {
  try {
    updateDocumentRequestStatus(req.params.id, "Received");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

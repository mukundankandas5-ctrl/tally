const express = require("express");
const multer = require("multer");
const { extractInvoice, normalizeInvoice, reviseInvoice } = require("../services/invoiceService");
const { buildInvoiceXml } = require("../services/tallyXmlService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

router.post("/extract", upload.single("file"), async (req, res, next) => {
  try {
    const invoice = await extractInvoice(req.file, req.body?.userInstructions || "");
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post("/revise", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const invoice = await reviseInvoice(req.body?.invoice || {}, req.body?.userInstructions || "");
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post("/export", express.json({ limit: "5mb" }), async (req, res, next) => {
  try {
    const invoice = normalizeInvoice(req.body || {});
    const xml = buildInvoiceXml(invoice);
    const fileSafeInvoiceNumber = (invoice.invoiceNumber || "purchase-voucher")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="${fileSafeInvoiceNumber}.xml"`);
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

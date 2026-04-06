const express = require("express");
const multer = require("multer");
const { analyzeBankStatement, reviseBankStatement } = require("../services/bankStatementService");
const { learnFromStatement } = require("../services/learningService");
const { buildBankStatementXml } = require("../services/tallyXmlService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

router.post("/analyze", upload.single("file"), async (req, res, next) => {
  try {
    const context = {
      clientId: req.body?.clientId,
      bankName: req.body?.bankName,
      companyName: req.body?.companyName,
      bankLedgerName: req.body?.bankLedgerName,
    };
    const result = await analyzeBankStatement(req.file, req.body?.userInstructions || "", context);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/analyze-bulk", upload.array("files", 12), async (req, res, next) => {
  try {
    const context = {
      clientId: req.body?.clientId,
      bankName: req.body?.bankName,
      companyName: req.body?.companyName,
      bankLedgerName: req.body?.bankLedgerName,
    };
    const files = Array.isArray(req.files) ? req.files : [];
    const jobs = [];

    for (const file of files) {
      try {
        const statement = await analyzeBankStatement(file, req.body?.userInstructions || "", context);
        jobs.push({
          id: `${file.originalname}-${jobs.length + 1}`,
          fileName: file.originalname,
          status: "processed",
          transactionCount: statement.summary?.transactionCount || 0,
          reviewCount: statement.summary?.reviewCount || 0,
          statement,
        });
      } catch (error) {
        jobs.push({
          id: `${file.originalname}-${jobs.length + 1}`,
          fileName: file.originalname,
          status: "failed",
          error: error.message,
        });
      }
    }

    res.json({
      jobs,
      summary: {
        totalFiles: jobs.length,
        processedFiles: jobs.filter((job) => job.status === "processed").length,
        failedFiles: jobs.filter((job) => job.status === "failed").length,
        totalTransactions: jobs.reduce((sum, job) => sum + Number(job.transactionCount || 0), 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/revise", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const result = await reviseBankStatement(req.body?.statement || {}, req.body?.userInstructions || "", {
      clientId: req.body?.statement?.tallyConfig?.clientId,
      bankName: req.body?.statement?.tallyConfig?.bankName,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/export", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const xml = buildBankStatementXml(req.body || {});
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", 'attachment; filename="bank-statement-vouchers.xml"');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

router.post("/learn", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const result = learnFromStatement(req.body?.statement || {}, req.body?.userInstructions || "", {
      clientId: req.body?.statement?.tallyConfig?.clientId,
      bankName: req.body?.statement?.tallyConfig?.bankName,
    });
    res.json({
      message: "Learned mapping rules from the current review.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

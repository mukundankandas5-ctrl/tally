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
    const result = await analyzeBankStatement(req.file, req.body?.userInstructions || "");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/revise", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const result = await reviseBankStatement(req.body?.statement || {}, req.body?.userInstructions || "");
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
    const result = learnFromStatement(req.body?.statement || {}, req.body?.userInstructions || "");
    res.json({
      message: "Learned mapping rules from the current review.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

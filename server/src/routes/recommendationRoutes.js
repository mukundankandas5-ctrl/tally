const express = require("express");
const multer = require("multer");
const { analyzeRecommendations, buildRecommendationStatement, reviseRecommendations } = require("../services/recommendationService");
const { buildBankStatementXml } = require("../services/tallyXmlService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post("/analyze", upload.single("file"), async (req, res, next) => {
  try {
    const result = await analyzeRecommendations(req.file, {
      clientId: req.body?.clientId,
      bankName: req.body?.bankName,
      companyName: req.body?.companyName,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/revise", express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const result = await reviseRecommendations(
      req.body?.payload,
      req.body?.userInstructions,
      req.body?.context
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/export", express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const xml = buildBankStatementXml(buildRecommendationStatement(req.body || {}));
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", 'attachment; filename="speedy-recommendations.xml"');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

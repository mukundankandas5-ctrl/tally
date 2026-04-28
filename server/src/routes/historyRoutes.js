const express = require("express");
const {
  getAnalysisHistoryItem,
  listAnalysisHistory,
  saveAnalysisHistory,
} = require("../db/database");

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    const clientId = req.query.clientId || null;
    const type = req.query.type || null;
    const limit = parseInt(req.query.limit || "100", 10);
    res.json({
      success: true,
      items: listAnalysisHistory({ clientId, type, limit }),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", (req, res, next) => {
  try {
    const item = getAnalysisHistoryItem(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Saved analysis was not found.",
      });
    }
    return res.json({ success: true, item });
  } catch (error) {
    return next(error);
  }
});

router.post("/", express.json({ limit: "15mb" }), (req, res, next) => {
  try {
    const type = String(req.body?.type || "").trim();
    const title = String(req.body?.title || "").trim();

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        message: "History type and title are required.",
      });
    }

    const id = saveAnalysisHistory({
      id: req.body?.id || null,
      clientId: req.body?.clientId || null,
      type,
      title,
      sourceFileName: req.body?.sourceFileName || "",
      resultData: req.body?.resultData || {},
      summary: req.body?.summary || {},
      status: req.body?.status || "completed",
    });

    return res.json({
      success: true,
      id,
      message: "Analysis saved to history.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const fs      = require("fs");
const express = require("express");
const multer  = require("multer");
const { reconcileGstr2b, getDownloadPath, deleteDownloadToken } = require("../services/gstr2bService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
});

// POST /api/reconcile/gstr2b
router.post(
  "/gstr2b",
  upload.fields([
    { name: "gstr2b",  maxCount: 1 },
    { name: "ledgers", maxCount: 6 },
  ]),
  async (req, res, next) => {
    try {
      const gstr2bFile = req.files?.gstr2b?.[0];
      const ledgerFiles = req.files?.ledgers || [];

      if (!gstr2bFile) {
        return res.status(400).json({ error: "gstr2b file is required." });
      }
      if (ledgerFiles.length === 0) {
        return res.status(400).json({ error: "At least one ledger file is required." });
      }

      const result = await reconcileGstr2b(
        gstr2bFile.buffer,
        ledgerFiles.map((f) => f.buffer)
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/reconcile/download/:id
router.get("/download/:id", (req, res, next) => {
  try {
    const filePath = getDownloadPath(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: "Download link has expired or is invalid." });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Report file not found." });
    }

    res.download(filePath, "GSTR2B_Reconciliation.xlsx", (err) => {
      if (!err) deleteDownloadToken(req.params.id);
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

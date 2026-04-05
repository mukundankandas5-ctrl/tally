const express = require("express");
const multer = require("multer");
const { reconcileGstFiles, buildGstWorkbook } = require("../services/gstService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
  "/reconcile",
  upload.fields([
    { name: "gstr2b", maxCount: 1 },
    { name: "purchaseRegister", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const result = await reconcileGstFiles(req.files?.gstr2b?.[0], req.files?.purchaseRegister?.[0]);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post("/export", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const workbook = buildGstWorkbook(req.body || {});
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="gst-reconciliation.xlsx"');
    res.send(workbook);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

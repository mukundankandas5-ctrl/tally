const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { reconcileGST, buildGstMismatchWorkbook, buildGstWorkbook } = require("../services/gstService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const OUTPUT_DIR = path.join(__dirname, "../data/tally-ai-gst");

// POST /api/gst/reconcile
router.post(
  "/reconcile",
  upload.fields([
    { name: "gstrFile", maxCount: 1 },
    { name: "registerFile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const gstrFile = req.files?.gstrFile?.[0];
      const registerFile = req.files?.registerFile?.[0];

      if (!gstrFile || !registerFile) {
        return res.status(400).json({
          error: "Both gstrFile and registerFile are required.",
        });
      }

      const registerType = String(req.body?.registerType || "purchase").toLowerCase();

      const { summary, results, reportPath } = await reconcileGST(
        gstrFile.buffer,
        registerFile.buffer,
        registerType,
        OUTPUT_DIR
      );

      // Normalize to the shape GstPage expects (rows + flat summary)
      const rows = results.map((r) => ({
        id:            r.pr_invoice_no || r.gstr_invoice_no || String(Math.random()),
        status:        r.status === "Matched"  ? "matched"   :
                       r.status === "Mismatch" ? "partial"   : "unmatched",
        invoiceNumber: r.pr_invoice_no    || r.gstr_invoice_no,
        gstin:         r.pr_gstin         || r.gstr_gstin,
        vendorName:    r.pr_vendor_name   || r.gstr_vendor_name,
        totalAmount:   r.pr_total_value   || r.gstr_total_value || 0,
        taxableValue:  r.pr_taxable_value || r.gstr_taxable_value || 0,
        riskBucket:    r.status === "Matched"  ? "Ready To File"      :
                       r.status === "Mismatch" ? "Value/State Mismatch":
                       r.status === "Missing"  ? "Missing In GSTR-2B" : "Extra In GSTR-2B",
        mismatchReason: r.discrepancy_details || "",
        purchaseRow:   null,
      }));

      const total = summary.prTotalInvoices || 0;
      const flatSummary = {
        total,
        matched:          summary.matched.count,
        partial:          summary.mismatch.count,
        unmatched:        summary.missing.count + summary.extra.count,
        duplicateInvoices: 0,
        missingGstin:     0,
        exactMatchRate:   total ? Number(((summary.matched.count / total) * 100).toFixed(1)) : 0,
        // pass full summary too so download has context
        _full: summary,
      };

      res.json({
        success: true,
        summary: flatSummary,
        rows,
        downloads: { report: reportPath },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/gst/download?path=...
router.get("/download", (req, res, next) => {
  try {
    const filePath = String(req.query.path || "");

    if (!filePath.includes("tally-ai-gst")) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }

    res.download(filePath);
  } catch (error) {
    next(error);
  }
});

// POST /api/gst/export  (kept for backward compatibility)
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

// POST /api/gst/export-mismatches  (kept for backward compatibility)
router.post("/export-mismatches", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const workbook = buildGstMismatchWorkbook(req.body || {});
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="gst-mismatched-entries.xlsx"');
    res.send(workbook);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const path    = require("path");
const ExcelJS = require("exceljs");
const { toNumber, toFixedAmount } = require("../utils/normalizers");

// ── Colour palette (exact from sample) ───────────────────────────────────────
const C = {
  navyDark:   "FF1F3864",   // titles, col-headers on recon / missing sheets
  navyMid:    "FF2E75B6",   // subtitle, metric headers
  redDark:    "FFC00000",   // missing sheet title + header + total row
  purple:     "FF7030A0",   // mismatch sheet title + header
  white:      "FFFFFFFF",
  matchedFill:"FFE2EFDA",   // summary breakdown row
  mismatchFill:"FFFFEB9C",
  missingFill: "FFFFC7CE",
  extraFill:   "FFBDD7EE",
  recoMatched: "FFF2F2F2",  // invoice recon grey (matched)
  recoMismatch:"FFFFE2E2",  // invoice recon pink (mismatch)
  missingAlt1: "FFFFE2E2",  // missing sheet alternating
  missingAlt2: "FFFFF0F0",
  mismatchAlt1:"FFF2E6FF",  // mismatch sheet alternating
  mismatchAlt2:"FFEDD9FF",
};

function fill(argb)  { return { type: "pattern", pattern: "solid", fgColor: { argb } }; }
function font(argb, opts = {}) { return { color: { argb }, ...opts }; }

function styleCell(cell, fillArgb, fontArgb, fontOpts = {}) {
  if (fillArgb) cell.fill = fill(fillArgb);
  cell.font = font(fontArgb || C.white, fontOpts);
  cell.alignment = { vertical: "middle", wrapText: true };
}

function styleRow(row, fillArgb, fontArgb, fontOpts = {}) {
  row.eachCell({ includeEmpty: true }, (cell) => styleCell(cell, fillArgb, fontArgb, fontOpts));
}

// ── Sheet 1: Reconciliation Summary ──────────────────────────────────────────

function buildSummarySheet(wb, summary) {
  const ws = wb.addWorksheet("Reconciliation Summary");

  ws.columns = [
    { key: "a", width: 6  },
    { key: "b", width: 28 },
    { key: "c", width: 22 },
    { key: "d", width: 20 },
    { key: "e", width: 18 },
    { key: "f", width: 40 },
  ];

  const lastCol = "F";

  // Row 1 — Main title
  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell("A1");
  title.value    = `GST PURCHASE RECONCILIATION REPORT — ${summary.period || ""}`;
  title.fill     = fill(C.navyDark);
  title.font     = { color: { argb: C.white }, bold: true, size: 13, name: "Arial" };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 26;

  // Row 2 — Subtitle
  ws.mergeCells(`A2:${lastCol}2`);
  const sub = ws.getCell("A2");
  sub.value    = "Purchase Register vs GSTR-2B";
  sub.fill     = fill(C.navyMid);
  sub.font     = { color: { argb: C.white }, bold: true, size: 11, name: "Arial" };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;

  // Row 3 — empty
  ws.getRow(3).height = 6;

  // Row 4 — Metric table column headers
  const hdrRow = ws.getRow(4);
  ["", "METRIC", "PURCHASE REGISTER", "GSTR-2B", "DIFFERENCE", "REMARK"].forEach((v, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = v;
    cell.fill  = fill(C.navyMid);
    cell.font  = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdrRow.height = 22;

  // Rows 5-7 — three metric rows
  const metrics = [
    {
      icon: "📋", label: "Total Invoices",
      pr: summary.prTotalInvoices, gstr: summary.gstrTotalInvoices,
      diff: summary.invoiceDiff, remark: summary.invoiceRemark,
    },
    {
      icon: "💰", label: "Total Taxable Value (₹)",
      pr: summary.prTotalTaxable, gstr: summary.gstrTotalTaxable,
      diff: summary.taxableDiff, remark: summary.taxableRemark,
    },
    {
      icon: "🏷️", label: "Total GST Amount (₹)",
      pr: summary.prTotalGst, gstr: summary.gstrTotalGst,
      diff: summary.gstDiff, remark: summary.gstRemark,
    },
  ];

  metrics.forEach(({ icon, label, pr, gstr, diff, remark }, idx) => {
    const r = ws.getRow(5 + idx);
    r.getCell(1).value = icon;
    r.getCell(2).value = label;
    r.getCell(3).value = pr;
    r.getCell(4).value = gstr;
    r.getCell(5).value = diff;
    r.getCell(6).value = remark;
    if (idx > 0) {
      [3, 4, 5].forEach((col) => { r.getCell(col).numFmt = "#,##0.00"; });
    }
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
    });
    r.height = 18;
  });

  // Row 8 — empty spacer
  ws.getRow(8).height = 6;

  // Row 9 — Breakdown header
  ws.mergeCells(`A9:${lastCol}9`);
  const brk = ws.getCell("A9");
  brk.value    = "RECONCILIATION BREAKDOWN";
  brk.fill     = fill(C.navyMid);
  brk.font     = { color: { argb: C.white }, bold: true, name: "Arial" };
  brk.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(9).height = 20;

  // Row 10 — Breakdown column headers
  const brkHdr = ws.getRow(10);
  ["STATUS", "COUNT", "TAXABLE VALUE (₹)", "GST AMOUNT (₹)", "ACTION REQUIRED", "IMPACT"].forEach((v, i) => {
    const cell = brkHdr.getCell(i + 1);
    cell.value = v;
    cell.fill  = fill(C.navyDark);
    cell.font  = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  brkHdr.height = 22;

  // Rows 11-14 — Breakdown data
  const breakdown = [
    {
      label: "✅ Fully Matched",
      count: summary.matched.count,
      taxable: summary.matched.taxable,
      gst: summary.matched.gst,
      action: "",
      impact: "ITC claimable",
      fillArgb: C.matchedFill,
    },
    {
      label: "⚠️ Amount/State Mismatch",
      count: summary.mismatch.count,
      taxable: summary.mismatch.taxable,
      gst: summary.mismatch.gstDiff,
      action: "Verify with supplier / amend",
      impact: "GST diff to be reconciled",
      fillArgb: C.mismatchFill,
    },
    {
      label: "❌ Missing in GSTR-2B",
      count: summary.missing.count,
      taxable: summary.missing.taxable,
      gst: summary.missing.gst,
      action: "Follow up with supplier",
      impact: "ITC blocked until 2B updated",
      fillArgb: C.missingFill,
    },
    {
      label: "➕ Extra in GSTR-2B",
      count: summary.extra.count,
      taxable: summary.extra.taxable,
      gst: summary.extra.gst,
      action: "Book in Purchase Register",
      impact: "Possible missed booking",
      fillArgb: C.extraFill,
    },
  ];

  breakdown.forEach(({ label, count, taxable, gst, action, impact, fillArgb }, idx) => {
    const r = ws.getRow(11 + idx);
    r.getCell(1).value = label;
    r.getCell(2).value = count;
    r.getCell(3).value = taxable;
    r.getCell(4).value = gst;
    r.getCell(5).value = action;
    r.getCell(6).value = impact;
    [3, 4].forEach((col) => { r.getCell(col).numFmt = "#,##0.00"; });
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(fillArgb);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    r.height = 18;
  });
}

// ── Sheet 2: Invoice Reconciliation ──────────────────────────────────────────

function buildInvoiceReconSheet(wb, results) {
  const ws = wb.addWorksheet("Invoice Reconciliation");

  const cols = [
    { header: "Invoice No",            key: "inv",      width: 14 },
    { header: "Vendor Name",           key: "vendor",   width: 22 },
    { header: "GSTIN",                 key: "gstin",    width: 22 },
    { header: "Invoice Date",          key: "date",     width: 14 },
    { header: "PR Taxable Value",      key: "prTax",    width: 18 },
    { header: "PR GST Amount",         key: "prGst",    width: 16 },
    { header: "PR State",              key: "prState",  width: 16 },
    { header: "2B Taxable Value",      key: "gstrTax",  width: 18 },
    { header: "2B GST Amount",         key: "gstrGst",  width: 16 },
    { header: "2B State",              key: "gstrState",width: 16 },
    { header: "Taxable Value Diff",    key: "taxDiff",  width: 18 },
    { header: "GST Amount Diff",       key: "gstDiff",  width: 16 },
    { header: "Reconciliation Status", key: "status",   width: 22 },
    { header: "Discrepancy Details",   key: "details",  width: 50 },
  ];

  ws.columns = cols;

  // Row 1 — title
  ws.mergeCells(`A1:${String.fromCharCode(64 + cols.length)}1`);
  const title = ws.getCell("A1");
  title.value    = "INVOICE-LEVEL RECONCILIATION — Purchase Register vs GSTR-2B";
  title.fill     = fill(C.navyDark);
  title.font     = { color: { argb: C.white }, bold: true, size: 12, name: "Arial" };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 24;

  // Row 2 — column headers
  const hdrRow = ws.getRow(2);
  cols.forEach((col, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill  = fill(C.navyDark);
    cell.font  = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdrRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };

  // Data rows — only Matched and Mismatch (not Missing/Extra which go to other sheets)
  const recoRows = results.filter((r) => r.status === "Matched" || r.status === "Mismatch");

  recoRows.forEach((r, idx) => {
    const row = ws.addRow([
      r.pr_invoice_no || r.gstr_invoice_no,
      r.pr_vendor_name || r.gstr_vendor_name,
      r.pr_gstin || r.gstr_gstin,
      r.pr_invoice_date || r.gstr_invoice_date,
      r.pr_taxable_value  || null,
      r.pr_gst_amount     || null,
      r.pr_state,
      r.gstr_taxable_value || null,
      r.gstr_gst_amount    || null,
      r.gstr_state,
      r.taxable_value_diff || 0,
      r.gst_amount_diff    || 0,
      r.status,
      r.discrepancy_details || "",
    ]);

    const rowFill = r.status === "Matched" ? C.recoMatched : C.recoMismatch;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(rowFill);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
    });
    // Number formats
    [5, 6, 8, 9, 11, 12].forEach((col) => { row.getCell(col).numFmt = "#,##0.00"; });
    row.height = 16;
  });
}

// ── Sheet 3: Missing in GSTR-2B ──────────────────────────────────────────────

function buildMissingSheet(wb, results) {
  const ws  = wb.addWorksheet("Missing in GSTR-2B");
  const missing = results.filter((r) => r.status === "Missing");

  const cols = [
    { header: "Vendor Name",         width: 22 },
    { header: "GSTIN",               width: 22 },
    { header: "Invoice No",          width: 14 },
    { header: "Invoice Date",        width: 14 },
    { header: "State",               width: 16 },
    { header: "Taxable Value",       width: 18 },
    { header: "GST Rate %",          width: 12 },
    { header: "GST Amount",          width: 16 },
    { header: "Total Invoice Value", width: 22 },
    { header: "Status",              width: 12 },
    { header: "Remark",              width: 50 },
  ];

  ws.columns = cols.map((c, i) => ({ key: `c${i}`, width: c.width }));

  const lastColLetter = String.fromCharCode(64 + cols.length);

  // Row 1 — title
  ws.mergeCells(`A1:${lastColLetter}1`);
  const title = ws.getCell("A1");
  title.value    = "INVOICES IN PURCHASE REGISTER BUT ABSENT FROM GSTR-2B (ITC at Risk)";
  title.fill     = fill(C.redDark);
  title.font     = { color: { argb: C.white }, bold: true, size: 12, name: "Arial" };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 24;

  // Row 2 — column headers
  const hdrRow = ws.getRow(2);
  cols.forEach((col, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill  = fill(C.redDark);
    cell.font  = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdrRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };

  let totalTaxable = 0, totalGst = 0, totalValue = 0;

  missing.forEach((r, idx) => {
    totalTaxable += toNumber(r.pr_taxable_value, 0);
    totalGst     += toNumber(r.pr_gst_amount, 0);
    totalValue   += toNumber(r.pr_total_value, 0);

    const rowFill = idx % 2 === 0 ? C.missingAlt1 : C.missingAlt2;
    const row = ws.addRow([
      r.pr_vendor_name,
      r.pr_gstin,
      r.pr_invoice_no,
      r.pr_invoice_date,
      r.pr_state,
      r.pr_taxable_value,
      r.pr_gst_rate,
      r.pr_gst_amount,
      r.pr_total_value,
      r.pr_status || "Recorded",
      "NOT in GSTR-2B – ITC at risk / follow up with supplier",
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(rowFill);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
    });
    [6, 8, 9].forEach((col) => { row.getCell(col).numFmt = "#,##0.00"; });
    row.height = 16;
  });

  // Total row
  const totalRow = ws.addRow([
    "TOTAL", "", "", "", "",
    toFixedAmount(totalTaxable), "",
    toFixedAmount(totalGst),
    toFixedAmount(totalValue),
    "", "",
  ]);
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(C.redDark);
    cell.font = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle" };
  });
  [6, 8, 9].forEach((col) => { totalRow.getCell(col).numFmt = "#,##0.00"; });
  totalRow.height = 18;
}

// ── Sheet 4: Mismatch Details ─────────────────────────────────────────────────

function buildMismatchSheet(wb, results) {
  const ws = wb.addWorksheet("Mismatch Details");
  const mismatch = results.filter((r) => r.status === "Mismatch");

  const cols = [
    { header: "Invoice No",        width: 14 },
    { header: "Vendor Name",       width: 22 },
    { header: "GSTIN",             width: 22 },
    { header: "PR GST Amount",     width: 16 },
    { header: "2B GST Amount",     width: 16 },
    { header: "GST Amount Diff",   width: 16 },
    { header: "PR State",          width: 16 },
    { header: "2B State",          width: 16 },
    { header: "Discrepancy Details", width: 52 },
  ];

  ws.columns = cols.map((c, i) => ({ key: `c${i}`, width: c.width }));

  const lastColLetter = String.fromCharCode(64 + cols.length);

  // Row 1 — title
  ws.mergeCells(`A1:${lastColLetter}1`);
  const title = ws.getCell("A1");
  title.value    = "MISMATCH DETAILS — Invoices Requiring Action / Supplier Clarification";
  title.fill     = fill(C.purple);
  title.font     = { color: { argb: C.white }, bold: true, size: 12, name: "Arial" };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 24;

  // Row 2 — column headers
  const hdrRow = ws.getRow(2);
  cols.forEach((col, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill  = fill(C.purple);
    cell.font  = { color: { argb: C.white }, bold: true, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hdrRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };

  mismatch.forEach((r, idx) => {
    const rowFill = idx % 2 === 0 ? C.mismatchAlt1 : C.mismatchAlt2;
    const row = ws.addRow([
      r.pr_invoice_no || r.gstr_invoice_no,
      r.pr_vendor_name || r.gstr_vendor_name,
      r.pr_gstin || r.gstr_gstin,
      r.pr_gst_amount  || null,
      r.gstr_gst_amount || null,
      r.gst_amount_diff || 0,
      r.pr_state,
      r.gstr_state,
      r.discrepancy_details || "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(rowFill);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle" };
    });
    [4, 5, 6].forEach((col) => { row.getCell(col).numFmt = "#,##0.00"; });
    row.height = 16;
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function generateReconciliationExcels({ results, summary, registerType = "purchase", outputDir }) {
  const timestamp   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath  = path.join(outputDir, `GST_Reconciliation_Report_${timestamp}.xlsx`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tally AI";
  wb.created = new Date();

  buildSummarySheet(wb, summary);
  buildInvoiceReconSheet(wb, results);
  buildMissingSheet(wb, results);
  buildMismatchSheet(wb, results);

  await wb.xlsx.writeFile(reportPath);

  return { reportPath };
}

module.exports = { generateReconciliationExcels };

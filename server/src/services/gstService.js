const fs = require("fs");
const XLSX = require("xlsx");
const AppError = require("../utils/appError");
const { cleanString, toFixedAmount, toIsoDate, toNumber } = require("../utils/normalizers");
const { generateReconciliationExcels } = require("./gstExportService");

// ── Column alias lists ────────────────────────────────────────────────────────

const ALIAS = {
  gstin:        ["gstin", "gstin of supplier", "supplier gstin", "party gstin", "gst no", "gstin/uin", "gstin/uin of supplier"],
  // invoiceNo covers both GSTR-2B's supplier invoice number AND Tally's voucher/ref fields
  invoiceNo:    [
    "invoice number of supplier", "supplier invoice number", "supplier invoice no",
    "invoice number", "invoice no",
    "ref no", "ref. no", "ref. no.", "reference no", "reference number", "ref",
    "bill no", "bill number",
    "voucher no", "vch no", "vch no.", "vch. no.",
    "document no", "document number",
  ],
  taxableValue: ["taxable value", "taxable amount", "taxable", "assessable value", "basic amount"],
  invoiceValue: ["total invoice value", "invoice value", "total value", "gross total", "gross amount"],
  gstAmount:    ["gst amount", "total tax amount", "total gst", "tax amount"],
  gstRate:      ["gst rate %", "gst rate", "rate %", "tax rate", "rate"],
  cgst:         ["cgst", "central tax", "central tax amount"],
  sgst:         ["sgst", "state tax", "state ut tax", "state/ut tax amount"],
  igst:         ["igst", "integrated tax", "integrated tax amount"],
  cess:         ["cess", "compensation cess"],
  name:         ["trade/legal name", "trade name", "supplier name", "party name", "vendor name", "party", "particulars"],
  state:        ["state", "state name", "place of supply", "supply state", "location of supply"],
  date:         ["date", "invoice date", "document date", "voucher date"],
  status:       ["status", "itc available"],
};

// ── Column lookup helpers ─────────────────────────────────────────────────────

function normalizeColumnName(value) {
  return cleanString(value).toLowerCase().replace(/[₹()/.]/g, " ").replace(/\s+/g, " ").trim();
}

function getValue(row, aliasList) {
  const normalized = aliasList.map(normalizeColumnName);
  const key = Object.keys(row).find((k) => normalized.includes(normalizeColumnName(k)));
  return key !== undefined ? row[key] : "";
}

function normalizeExcelDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return XLSX.SSF.format("yyyy-mm-dd", value);
  }
  return toIsoDate(value) || String(value || "");
}

// ── Amount derivation ─────────────────────────────────────────────────────────

function deriveComparableTaxableValue(row) {
  for (const alias of ALIAS.taxableValue) {
    const v = toNumber(getValue(row, [alias]), 0);
    if (v > 0) return toFixedAmount(v);
  }
  const inv = toNumber(getValue(row, ALIAS.invoiceValue), 0);
  if (inv > 0) {
    const taxes = ["cgst", "sgst", "igst", "cess"].reduce(
      (s, k) => s + toNumber(getValue(row, ALIAS[k]), 0),
      0
    );
    return toFixedAmount(inv - taxes);
  }
  return 0;
}

function deriveGstAmount(row) {
  const direct = toNumber(getValue(row, ALIAS.gstAmount), 0);
  if (direct > 0) return toFixedAmount(direct);
  const sum = ["cgst", "sgst", "igst"].reduce(
    (s, k) => s + toNumber(getValue(row, ALIAS[k]), 0),
    0
  );
  return toFixedAmount(sum);
}

// ── Spreadsheet parsing ───────────────────────────────────────────────────────

function normalizeHeader(value) {
  return cleanString(value).toLowerCase().replace(/\s+/g, " ");
}

function findHeaderRow(rows, requiredHeaders) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return requiredHeaders.every((h) => headers.includes(h));
  });
}

function combineGstr2bHeaders(first = [], second = []) {
  return second.map((v, i) => {
    const child = cleanString(v);
    const parent = cleanString(first[i]);
    if (child) return child;
    if (parent) return parent;
    return `Column ${i + 1}`;
  });
}

function rowsToObjects(rows, headers, startIndex) {
  return rows.slice(startIndex).map((row, idx) => {
    const obj = { rowId: `row-${idx + 1}` };
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });
}

function normalizeSpreadsheetRows(rows, sheetName = "") {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  if (/^B2B$/i.test(sheetName)) {
    const hi = findHeaderRow(rows, ["gstin of supplier", "trade/legal name"]);
    if (hi >= 0) {
      const headers = combineGstr2bHeaders(rows[hi], rows[hi + 1] || []);
      return rowsToObjects(rows, headers, hi + 2);
    }
  }

  const ledgerHi = findHeaderRow(rows, ["date", "particulars", "vch no.", "debit"]);
  if (ledgerHi >= 0) {
    const headers = rows[ledgerHi].map((h, i) =>
      !cleanString(h) && i === 2 ? "Party" : cleanString(h) || `Column ${i + 1}`
    );
    return rowsToObjects(rows, headers, ledgerHi + 1);
  }

  const simpleHi = rows.findIndex((row) => row.filter((c) => cleanString(c)).length >= 3);
  if (simpleHi >= 0) {
    const headers = rows[simpleHi].map((h, i) => cleanString(h) || `Column ${i + 1}`);
    return rowsToObjects(rows, headers, simpleHi + 1);
  }

  return [];
}

function readSpreadsheet(buffer, preferredSheet = null) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    (preferredSheet && workbook.SheetNames.find((n) => n.toLowerCase() === preferredSheet.toLowerCase())) ||
    workbook.SheetNames.find((n) => /^(B2B|GSTR2B|GSTR-2B|GSTR_2B)$/i.test(n)) ||
    workbook.SheetNames.find((n) => /input central tax|input state tax|input integrated tax/i.test(n)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return normalizeSpreadsheetRows(
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }),
    sheetName
  );
}

function readRegisterSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  // For register files, prefer non-GSTR sheets (e.g. Purchase_Register, Sales_Register)
  const sheetName =
    workbook.SheetNames.find((n) => /purchase|sales|register/i.test(n) && !/gstr/i.test(n)) ||
    workbook.SheetNames.find((n) => !/^(B2B|GSTR2B|GSTR-2B|GSTR_2B)$/i.test(n)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return normalizeSpreadsheetRows(
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }),
    sheetName
  );
}

// ── Row normalization ─────────────────────────────────────────────────────────

function normalizeRow(rawRow, index) {
  const taxableValue = deriveComparableTaxableValue(rawRow);
  const gstAmount = deriveGstAmount(rawRow);
  const totalValue =
    toFixedAmount(toNumber(getValue(rawRow, ALIAS.invoiceValue), 0)) ||
    toFixedAmount(taxableValue + gstAmount);

  return {
    id:           cleanString(rawRow.rowId || `gst-${index + 1}`),
    invoiceNumber: cleanString(getValue(rawRow, ALIAS.invoiceNo)),
    gstin:        cleanString(getValue(rawRow, ALIAS.gstin)),
    vendorName:   cleanString(getValue(rawRow, ALIAS.name)),
    date:         normalizeExcelDate(getValue(rawRow, ALIAS.date)),
    state:        cleanString(getValue(rawRow, ALIAS.state)),
    taxableValue,
    gstRate:      cleanString(getValue(rawRow, ALIAS.gstRate)),
    gstAmount,
    totalValue,
    vendorStatus: cleanString(getValue(rawRow, ALIAS.status)),
  };
}

// ── Match engine ──────────────────────────────────────────────────────────────

// Strip everything except alphanumerics → "INV-2026/001" → "inv2026001"
function normalizeKey(str) {
  return cleanString(str).toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

// Extract the trailing digit run, strip leading zeros → "VCRPL/23-24/326" → "326"
function numericSuffix(str) {
  const m = normalizeKey(str).match(/(\d+)$/);
  if (!m) return null;
  return String(parseInt(m[1], 10)); // removes leading zeros
}

// Return true if two invoice strings are plausibly the same number.
// Handles: exact normalized match, one is a suffix of the other, shared numeric tail.
function fuzzyInvoiceMatch(a, b) {
  if (!a || !b) return false;
  const aN = normalizeKey(a);
  const bN = normalizeKey(b);
  if (aN === bN) return true;
  if (aN && bN && (aN.endsWith(bN) || bN.endsWith(aN))) return true;
  const as = numericSuffix(a);
  const bs = numericSuffix(b);
  // Only trust suffix match when the number is long enough to be unique (≥3 digits)
  if (as && bs && as === bs && as.length >= 3) return true;
  return false;
}

// Parse a date string to a JS timestamp (ms). Returns NaN on failure.
function parseDate(str) {
  if (!str) return NaN;
  // ISO yyyy-mm-dd
  let m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  // DD-MM-YYYY or DD/MM/YYYY
  m = String(str).match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return NaN;
}

function daysBetween(dateA, dateB) {
  const a = parseDate(dateA);
  const b = parseDate(dateB);
  if (isNaN(a) || isNaN(b)) return 999;
  return Math.abs(a - b) / 86400000;
}

function buildDiscrepancyDetails(prRow, gstrRow, matchTier) {
  const parts = [];
  if (matchTier === "fuzzy") {
    parts.push(`Invoice No. format differs: PR="${prRow.invoiceNumber}" vs 2B="${gstrRow.invoiceNumber}"`);
  }
  if (matchTier === "amount") {
    parts.push(`Matched on GSTIN + amount + date (invoice numbers differ: PR="${prRow.invoiceNumber}" vs 2B="${gstrRow.invoiceNumber}")`);
  }
  const gstDiff = toFixedAmount(prRow.gstAmount - gstrRow.gstAmount);
  if (Math.abs(gstDiff) > 0.01) {
    parts.push(`GST Amt: PR=${prRow.gstAmount.toFixed(2)} vs 2B=${gstrRow.gstAmount.toFixed(2)}`);
  }
  if (prRow.taxableValue && gstrRow.taxableValue) {
    const tDiff = toFixedAmount(prRow.taxableValue - gstrRow.taxableValue);
    if (Math.abs(tDiff) > 1) {
      parts.push(`Taxable Value: PR=${prRow.taxableValue.toFixed(2)} vs 2B=${gstrRow.taxableValue.toFixed(2)}`);
    }
  }
  const prState   = normalizeKey(prRow.state);
  const gstrState = normalizeKey(gstrRow.state);
  if (prState && gstrState && prState !== gstrState) {
    parts.push(`State: PR=${prRow.state} vs 2B=${gstrRow.state}`);
  }
  return parts.join(" | ");
}

function buildPairedResult(prRow, gstrRow, matchTier) {
  const taxableDiff  = toFixedAmount(prRow.taxableValue - gstrRow.taxableValue);
  const gstDiff      = toFixedAmount(prRow.gstAmount   - gstrRow.gstAmount);
  const stateMismatch =
    normalizeKey(prRow.state) &&
    normalizeKey(gstrRow.state) &&
    normalizeKey(prRow.state) !== normalizeKey(gstrRow.state);
  const amountMismatch = Math.abs(taxableDiff) > 1 || Math.abs(gstDiff) > 0.01;

  // Exact tier with no differences → Matched. Everything else → Mismatch.
  const isClean = matchTier === "exact" && !amountMismatch && !stateMismatch;

  return {
    status:             isClean ? "Matched" : "Mismatch",
    pr_vendor_name:     prRow.vendorName,
    pr_gstin:           prRow.gstin,
    pr_invoice_no:      prRow.invoiceNumber,
    pr_invoice_date:    prRow.date,
    pr_state:           prRow.state,
    pr_taxable_value:   prRow.taxableValue,
    pr_gst_rate:        prRow.gstRate,
    pr_gst_amount:      prRow.gstAmount,
    pr_total_value:     prRow.totalValue,
    pr_status:          prRow.vendorStatus,
    gstr_vendor_name:   gstrRow.vendorName,
    gstr_gstin:         gstrRow.gstin,
    gstr_invoice_no:    gstrRow.invoiceNumber,
    gstr_invoice_date:  gstrRow.date,
    gstr_state:         gstrRow.state,
    gstr_taxable_value: gstrRow.taxableValue,
    gstr_gst_rate:      gstrRow.gstRate,
    gstr_gst_amount:    gstrRow.gstAmount,
    gstr_total_value:   gstrRow.totalValue,
    gstr_status:        gstrRow.vendorStatus,
    taxable_value_diff: taxableDiff,
    gst_amount_diff:    gstDiff,
    match_tier:         matchTier,
    discrepancy_details: isClean ? "" : buildDiscrepancyDetails(prRow, gstrRow, matchTier),
    _gstrRow: gstrRow._gstrRow || null,
    _prRow:   prRow._prRow    || null,
  };
}

function matchRows(gstrRows, registerRows) {
  // ── Build register lookup structures ───────────────────────────────────────
  // exactMap:  "gstin::invoiceKey" → regRow
  // gstinMap:  "gstin" → [regRow, ...]
  const exactMap  = new Map();
  const gstinMap  = new Map();

  for (const row of registerRows) {
    const gKey  = normalizeKey(row.gstin);
    const iKey  = normalizeKey(row.invoiceNumber);
    const exact = `${gKey}::${iKey}`;
    if (!exactMap.has(exact)) exactMap.set(exact, row);
    if (gKey) {
      if (!gstinMap.has(gKey)) gstinMap.set(gKey, []);
      gstinMap.get(gKey).push(row);
    }
  }

  const usedRows = new Set(); // tracks matched register rows by reference
  const results  = [];

  for (const gstrRow of gstrRows) {
    const gKey  = normalizeKey(gstrRow.gstin);
    const iKey  = normalizeKey(gstrRow.invoiceNumber);
    const exact = `${gKey}::${iKey}`;

    // ── Tier 1: GSTIN + exact invoice number ─────────────────────────────────
    const t1 = exactMap.get(exact);
    if (t1 && !usedRows.has(t1)) {
      usedRows.add(t1);
      results.push(buildPairedResult(t1, gstrRow, "exact"));
      continue;
    }

    // ── Tier 2: GSTIN + fuzzy invoice number ──────────────────────────────────
    const candidates = gKey ? (gstinMap.get(gKey) || []) : [];
    const t2 = candidates.find(
      (r) => !usedRows.has(r) && fuzzyInvoiceMatch(r.invoiceNumber, gstrRow.invoiceNumber)
    );
    if (t2) {
      usedRows.add(t2);
      results.push(buildPairedResult(t2, gstrRow, "fuzzy"));
      continue;
    }

    // ── Tier 3: GSTIN + taxable amount (±₹5) + date within 31 days ───────────
    // This handles the common real-world case where Tally uses internal voucher
    // numbers that have no relation to the supplier's invoice number in GSTR-2B.
    const t3 = candidates.find((r) => {
      if (usedRows.has(r)) return false;
      const amtOk  = Math.abs(r.taxableValue - gstrRow.taxableValue) <= 5;
      const dateOk = daysBetween(r.date, gstrRow.date) <= 31;
      return amtOk && dateOk;
    });
    if (t3) {
      usedRows.add(t3);
      results.push(buildPairedResult(t3, gstrRow, "amount"));
      continue;
    }

    // ── No match → Extra in GSTR-2B ───────────────────────────────────────────
    results.push({
      status: "Extra",
      pr_vendor_name: "", pr_gstin: "", pr_invoice_no: "", pr_invoice_date: "",
      pr_state: "", pr_taxable_value: 0, pr_gst_rate: "", pr_gst_amount: 0,
      pr_total_value: 0, pr_status: "",
      gstr_vendor_name:   gstrRow.vendorName,
      gstr_gstin:         gstrRow.gstin,
      gstr_invoice_no:    gstrRow.invoiceNumber,
      gstr_invoice_date:  gstrRow.date,
      gstr_state:         gstrRow.state,
      gstr_taxable_value: gstrRow.taxableValue,
      gstr_gst_rate:      gstrRow.gstRate,
      gstr_gst_amount:    gstrRow.gstAmount,
      gstr_total_value:   gstrRow.totalValue,
      gstr_status:        gstrRow.vendorStatus,
      taxable_value_diff: 0, gst_amount_diff: 0, match_tier: "none",
      discrepancy_details: "Present in GSTR-2B but not found in Purchase Register.",
      _gstrRow: gstrRow._gstrRow || null, _prRow: null,
    });
  }

  // ── Register rows with no GSTR-2B pair → Missing ─────────────────────────
  for (const regRow of registerRows) {
    if (!usedRows.has(regRow)) {
      results.push({
        status: "Missing",
        pr_vendor_name:   regRow.vendorName,
        pr_gstin:         regRow.gstin,
        pr_invoice_no:    regRow.invoiceNumber,
        pr_invoice_date:  regRow.date,
        pr_state:         regRow.state,
        pr_taxable_value: regRow.taxableValue,
        pr_gst_rate:      regRow.gstRate,
        pr_gst_amount:    regRow.gstAmount,
        pr_total_value:   regRow.totalValue,
        pr_status:        regRow.vendorStatus,
        gstr_vendor_name: "", gstr_gstin: "", gstr_invoice_no: "", gstr_invoice_date: "",
        gstr_state: "", gstr_taxable_value: 0, gstr_gst_rate: "", gstr_gst_amount: 0,
        gstr_total_value: 0, gstr_status: "",
        taxable_value_diff: 0, gst_amount_diff: 0, match_tier: "none",
        discrepancy_details: "NOT in GSTR-2B – ITC at risk / follow up with supplier",
        _gstrRow: null, _prRow: regRow._prRow || null,
      });
    }
  }

  return results;
}

// ── Summary builder ───────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function derivePeriod(results) {
  const parsed = [];
  for (const r of results) {
    for (const d of [r.pr_invoice_date, r.gstr_invoice_date]) {
      if (!d || typeof d !== "string") continue;
      let m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) { parsed.push(new Date(+m[1], +m[2] - 1, +m[3])); continue; }
      m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) { parsed.push(new Date(+m[3], +m[2] - 1, +m[1])); }
    }
  }
  if (!parsed.length) return "";
  parsed.sort((a, b) => a - b);
  const first = parsed[0];
  const last  = parsed[parsed.length - 1];
  const year  = last.getFullYear();
  const firstM = MONTHS[first.getMonth()];
  const lastM  = MONTHS[last.getMonth()];
  return firstM === lastM ? `${firstM} ${year}` : `${firstM}–${lastM} ${year}`;
}

function buildMatchSummary(results) {
  const matched  = results.filter((r) => r.status === "Matched");
  const mismatch = results.filter((r) => r.status === "Mismatch");
  const missing  = results.filter((r) => r.status === "Missing");
  const extra    = results.filter((r) => r.status === "Extra");

  const sumField = (arr, field) =>
    toFixedAmount(arr.reduce((s, r) => s + toNumber(r[field], 0), 0));

  const prTotal   = matched.length + mismatch.length + missing.length;
  const gstrTotal = matched.length + mismatch.length + extra.length;

  const prTotalTaxable  = sumField([...matched, ...mismatch, ...missing], "pr_taxable_value");
  const gstrTotalTaxable = sumField([...matched, ...mismatch, ...extra],  "gstr_taxable_value");
  const prTotalGst      = sumField([...matched, ...mismatch, ...missing], "pr_gst_amount");
  const gstrTotalGst    = sumField([...matched, ...mismatch, ...extra],   "gstr_gst_amount");

  const taxableDiff = toFixedAmount(prTotalTaxable - gstrTotalTaxable);
  const gstDiff     = toFixedAmount(prTotalGst     - gstrTotalGst);

  const invDiff = prTotal - gstrTotal;

  return {
    period: derivePeriod(results),
    prTotalInvoices:  prTotal,
    gstrTotalInvoices: gstrTotal,
    invoiceDiff:      invDiff,
    invoiceRemark:
      invDiff > 0 ? `${invDiff} invoice${invDiff > 1 ? "s" : ""} missing in GSTR-2B` :
      invDiff < 0 ? `${Math.abs(invDiff)} extra invoice${Math.abs(invDiff) > 1 ? "s" : ""} in GSTR-2B` :
      "All invoices accounted for",
    prTotalTaxable,
    gstrTotalTaxable,
    taxableDiff,
    taxableRemark: taxableDiff > 0 ? "Shortfall in supplier reporting" :
                   taxableDiff < 0 ? "Excess reported in GSTR-2B"    :
                   "Taxable values match",
    prTotalGst,
    gstrTotalGst,
    gstDiff,
    gstRemark: Math.abs(gstDiff) > 0.01 ? "ITC to be reviewed" : "GST amounts match",
    matched:  { count: matched.length,  taxable: sumField(matched,  "pr_taxable_value"), gst: sumField(matched, "pr_gst_amount") },
    mismatch: { count: mismatch.length, taxable: sumField(mismatch, "pr_taxable_value"), gstDiff: toFixedAmount(mismatch.reduce((s, r) => s + toNumber(r.gst_amount_diff, 0), 0)) },
    missing:  { count: missing.length,  taxable: sumField(missing,  "pr_taxable_value"), gst: sumField(missing, "pr_gst_amount") },
    extra:    { count: extra.length,    taxable: sumField(extra,    "gstr_taxable_value"), gst: sumField(extra, "gstr_gst_amount") },
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

async function reconcileGST(gstrBuffer, registerBuffer, registerType = "purchase", outputDir) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let gstrRawRows, registerRawRows;
  try {
    gstrRawRows = readSpreadsheet(gstrBuffer);
  } catch (e) {
    throw new AppError("GSTR-2B file could not be parsed.", 400, { cause: e.message });
  }
  try {
    registerRawRows = readRegisterSpreadsheet(registerBuffer);
  } catch (e) {
    throw new AppError("Register file could not be parsed.", 400, { cause: e.message });
  }

  const gstrRows     = gstrRawRows.map((raw, i) => ({ ...normalizeRow(raw, i), _gstrRow: raw }));
  const registerRows = registerRawRows.map((raw, i) => ({ ...normalizeRow(raw, i), _prRow: raw }));

  const validGstr = gstrRows.filter((r) => r.invoiceNumber || r.gstin);
  const validReg  = registerRows.filter((r) => r.invoiceNumber || r.gstin);

  if (validGstr.length === 0)
    throw new AppError("GSTR-2B file has no recognizable rows. Check column headers.", 400);
  if (validReg.length === 0)
    throw new AppError("Register file has no recognizable rows. Check column headers.", 400);

  const results = matchRows(validGstr, validReg);
  const summary = buildMatchSummary(results);

  const { reportPath } = await generateReconciliationExcels({ results, summary, registerType, outputDir });

  return { summary, results, reportPath };
}

// ── Legacy helpers (kept for /export and /export-mismatches routes) ───────────

function buildGstWorkbook(report = {}) {
  const wb   = XLSX.utils.book_new();
  const rows = Array.isArray(report.rows) ? report.rows : [];

  const flatten = (row) => ({
    Status:           row.status || "",
    InvoiceNo:        row.pr_invoice_no || row.gstr_invoice_no || row.invoiceNumber || "",
    VendorName:       row.pr_vendor_name || row.gstr_vendor_name || row.vendorName || "",
    GSTIN:            row.pr_gstin || row.gstr_gstin || row.gstin || "",
    PRTaxableValue:   row.pr_taxable_value ?? "",
    PRGSTAmount:      row.pr_gst_amount ?? "",
    PRState:          row.pr_state || "",
    GSTRTaxableValue: row.gstr_taxable_value ?? "",
    GSTRGSTAmount:    row.gstr_gst_amount ?? "",
    GSTRState:        row.gstr_state || "",
    TaxableDiff:      row.taxable_value_diff ?? "",
    GSTDiff:          row.gst_amount_diff ?? "",
    DiscrepancyDetails: row.discrepancy_details || row.mismatchReason || "",
  });

  ["Matched","Mismatch","Missing","Extra"].forEach((status) => {
    const sheetRows = rows.filter((r) => (r.status || "").toLowerCase() === status.toLowerCase()).map(flatten);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), status.toUpperCase());
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{
      Matched:   toNumber(report.summary?.matched?.count  ?? report.summary?.matched,  0),
      Mismatch:  toNumber(report.summary?.mismatch?.count ?? report.summary?.partial,  0),
      Missing:   toNumber(report.summary?.missing?.count  ?? report.summary?.unmatched, 0),
      Extra:     toNumber(report.summary?.extra?.count    ?? 0, 0),
      Total:     toNumber(report.summary?.prTotalInvoices ?? report.summary?.total, 0),
    }]),
    "SUMMARY"
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function buildGstMismatchWorkbook(report = {}) {
  return buildGstWorkbook({
    ...report,
    rows: Array.isArray(report.rows)
      ? report.rows.filter((r) => (r.status || "").toLowerCase() !== "matched")
      : [],
  });
}

module.exports = { reconcileGST, buildGstWorkbook, buildGstMismatchWorkbook };

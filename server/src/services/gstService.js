const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const AppError = require("../utils/appError");
const { cleanString, toFixedAmount, toIsoDate, toNumber } = require("../utils/normalizers");

const invoiceKeys = ["invoice number", "invoice no", "invoice", "bill no"];
const gstinKeys = ["gstin", "supplier gstin", "vendor gstin"];
const taxableKeys = ["taxable value", "taxable amount", "subtotal"];
const cgstKeys = ["cgst"];
const sgstKeys = ["sgst"];
const igstKeys = ["igst"];
const totalKeys = ["total", "invoice value", "gross total", "amount"];
const vendorKeys = ["vendor", "supplier", "party name"];
const dateKeys = ["date", "invoice date"];

function getValue(row, keys) {
  const key = Object.keys(row).find((candidate) => keys.includes(String(candidate).trim().toLowerCase()));
  return key ? row[key] : "";
}

function readSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
}

async function readPdfRows(buffer) {
  const result = await pdfParse(buffer);
  return cleanString(result.text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .map((line, index) => ({
      rowId: `pdf-${index + 1}`,
      invoice: line,
    }));
}

async function readRows(file) {
  if (!file?.buffer) {
    throw new AppError("Both GSTR-2B and purchase register files are required.", 400);
  }

  try {
    if (file.mimetype === "application/pdf") {
      return await readPdfRows(file.buffer);
    }

    return readSpreadsheet(file.buffer);
  } catch (error) {
    throw new AppError("One of the uploaded GST files could not be parsed.", 400, {
      cause: error.message,
    });
  }
}

function normalizeRow(row, index) {
  const taxableValue = toFixedAmount(getValue(row, taxableKeys));
  const cgst = toFixedAmount(getValue(row, cgstKeys));
  const sgst = toFixedAmount(getValue(row, sgstKeys));
  const igst = toFixedAmount(getValue(row, igstKeys));
  const totalTax = toFixedAmount(cgst + sgst + igst);
  const totalAmount = toFixedAmount(getValue(row, totalKeys) || taxableValue + totalTax);

  return {
    id: cleanString(row.rowId || `gst-${index + 1}`),
    invoiceNumber: cleanString(getValue(row, invoiceKeys) || row.invoice || row.Invoice || row["Invoice No"]),
    gstin: cleanString(getValue(row, gstinKeys)),
    vendorName: cleanString(getValue(row, vendorKeys)),
    date: toIsoDate(getValue(row, dateKeys)),
    taxableValue,
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount,
  };
}

function amountDiff(first, second) {
  return Math.abs(toNumber(first, 0) - toNumber(second, 0));
}

async function reconcileGstFiles(gstr2bFile, purchaseRegisterFile) {
  const gstrRows = (await readRows(gstr2bFile)).map(normalizeRow).filter((row) => row.invoiceNumber);
  const purchaseRows = (await readRows(purchaseRegisterFile)).map(normalizeRow).filter((row) => row.invoiceNumber);

  const purchaseByKey = new Map(
    purchaseRows.map((row) => [`${row.invoiceNumber.toLowerCase()}|${row.gstin.toLowerCase()}`, row])
  );

  const results = gstrRows.map((gstrRow) => {
    const key = `${gstrRow.invoiceNumber.toLowerCase()}|${gstrRow.gstin.toLowerCase()}`;
    const purchaseRow = purchaseByKey.get(key);

    if (!purchaseRow) {
      return {
        ...gstrRow,
        status: "unmatched",
        mismatchReason: "Invoice not found in purchase register.",
        purchaseRow: null,
      };
    }

    const totalDiff = amountDiff(gstrRow.totalAmount, purchaseRow.totalAmount);
    const taxDiff = amountDiff(gstrRow.totalTax, purchaseRow.totalTax);
    const status = totalDiff <= 1 && taxDiff <= 1 ? "matched" : "partial";

    return {
      ...gstrRow,
      status,
      mismatchReason:
        status === "matched"
          ? "Values match within tolerance."
          : `Value mismatch. Total diff ${totalDiff.toFixed(2)}, tax diff ${taxDiff.toFixed(2)}.`,
      purchaseRow,
    };
  });

  return {
    summary: {
      matched: results.filter((row) => row.status === "matched").length,
      partial: results.filter((row) => row.status === "partial").length,
      unmatched: results.filter((row) => row.status === "unmatched").length,
      total: results.length,
    },
    rows: results,
  };
}

function buildGstWorkbook(report = {}) {
  const workbook = XLSX.utils.book_new();
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const flatten = (row) => ({
    Status: row.status,
    InvoiceNumber: row.invoiceNumber,
    GSTIN: row.gstin,
    VendorName: row.vendorName,
    Date: row.date,
    TaxableValue: row.taxableValue,
    TotalTax: row.totalTax,
    TotalAmount: row.totalAmount,
    PurchaseRegisterAmount: toFixedAmount(row.purchaseRow?.totalAmount),
    Reason: row.mismatchReason,
  });

  ["matched", "partial", "unmatched"].forEach((status) => {
    const sheetRows = rows.filter((row) => row.status === status).map(flatten);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), status.toUpperCase());
  });

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        Matched: toNumber(report.summary?.matched, 0),
        Partial: toNumber(report.summary?.partial, 0),
        Unmatched: toNumber(report.summary?.unmatched, 0),
        Total: toNumber(report.summary?.total, 0),
      },
    ]),
    "SUMMARY"
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  buildGstWorkbook,
  reconcileGstFiles,
};

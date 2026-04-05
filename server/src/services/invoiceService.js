const pdfParse = require("pdf-parse");
const { requestStructuredJson } = require("./anthropicService");
const { defaultVoucherLedgers } = require("../constants/ledgerHeads");
const AppError = require("../utils/appError");
const {
  cleanString,
  ensureArray,
  normalizeConfidence,
  toFixedAmount,
  toIsoDate,
  toNumber,
} = require("../utils/normalizers");

function sanitizeUserInstructions(value) {
  return cleanString(value).slice(0, 4000);
}

async function extractPdfText(buffer) {
  try {
    const result = await pdfParse(buffer);
    return cleanString(result.text);
  } catch (error) {
    return "";
  }
}

function buildInvoiceContentBlocks(file, extractedText) {
  const base64Data = file.buffer.toString("base64");
  const content = [
    {
      type: "text",
      text: [
        "Extract the invoice into the required JSON schema.",
        "Prefer exact values from the document and use null or empty strings when a field is missing.",
        "Set confidence to high, medium, or low based on the overall reliability of the extraction.",
        "Return JSON only.",
      ].join(" "),
    },
  ];

  if (file.mimetype === "application/pdf") {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Data,
      },
    });
  } else {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: file.mimetype,
        data: base64Data,
      },
    });
  }

  if (extractedText) {
    content.push({
      type: "text",
      text: `Supplemental OCR/text extracted from the PDF:\n${extractedText}`,
    });
  }

  return content;
}

function normalizeInvoice(payload) {
  const tallySource = payload.tallyConfig || payload;
  const lineItems = ensureArray(payload.lineItems).map((item, index) => ({
    id: `line-${index + 1}`,
    description: cleanString(item.description),
    hsnSacCode: cleanString(item.hsnSacCode || item.hsnSac || item.hsn || item.sac),
    quantity: toFixedAmount(item.quantity || 0),
    rate: toFixedAmount(item.rate || 0),
    amount: toFixedAmount(item.amount || 0),
  }));

  const computedSubtotal =
    lineItems.length > 0
      ? lineItems.reduce((sum, item) => sum + toNumber(item.amount, 0), 0)
      : toNumber(payload.subtotal, 0);

  const cgst = toFixedAmount(payload.cgst);
  const sgst = toFixedAmount(payload.sgst);
  const igst = toFixedAmount(payload.igst);
  const subtotal = toFixedAmount(payload.subtotal || computedSubtotal);
  const total = toFixedAmount(payload.total || subtotal + cgst + sgst + igst);

  return {
    confidence: normalizeConfidence(payload.confidence),
    vendorName: cleanString(payload.vendorName),
    invoiceNumber: cleanString(payload.invoiceNumber),
    invoiceDate: toIsoDate(payload.invoiceDate),
    dueDate: toIsoDate(payload.dueDate),
    vendorGstin: cleanString(payload.vendorGstin),
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    lineItems,
    reviewNotes: ensureArray(payload.reviewNotes)
      .map((note) => cleanString(note))
      .filter(Boolean),
    tallyConfig: {
      companyName: cleanString(tallySource.companyName),
      purchaseLedgerName: cleanString(
        tallySource.purchaseLedgerName,
        defaultVoucherLedgers.purchaseLedgerName
      ),
      cgstLedgerName: cleanString(tallySource.cgstLedgerName, defaultVoucherLedgers.cgstLedgerName),
      sgstLedgerName: cleanString(tallySource.sgstLedgerName, defaultVoucherLedgers.sgstLedgerName),
      igstLedgerName: cleanString(tallySource.igstLedgerName, defaultVoucherLedgers.igstLedgerName),
    },
  };
}

async function extractInvoice(file, userInstructions = "") {
  if (!file) {
    throw new AppError("Please upload an invoice file.", 400);
  }

  const extractedText = file.mimetype === "application/pdf" ? await extractPdfText(file.buffer) : "";
  const safeInstructions = sanitizeUserInstructions(userInstructions);
  const instructionBlock = safeInstructions
    ? `Follow these additional user instructions when extracting or revising the invoice:\n${safeInstructions}`
    : "";

  const structured = await requestStructuredJson({
    systemPrompt: [
      "You are an expert Indian accounting data extraction engine.",
      "Read the uploaded invoice and return valid JSON with exactly these keys:",
      "{",
      '  "confidence": "high|medium|low",',
      '  "vendorName": "",',
      '  "invoiceNumber": "",',
      '  "invoiceDate": "YYYY-MM-DD or empty string",',
      '  "dueDate": "YYYY-MM-DD or empty string",',
      '  "vendorGstin": "",',
      '  "subtotal": 0,',
      '  "cgst": 0,',
      '  "sgst": 0,',
      '  "igst": 0,',
      '  "total": 0,',
      '  "lineItems": [',
      '    {"description": "", "hsnSacCode": "", "quantity": 0, "rate": 0, "amount": 0}',
      "  ],",
      '  "reviewNotes": [""]',
      "}",
      "Do not include markdown or commentary.",
      "Use Indian tax terminology and preserve invoice values as accurately as possible.",
      "If the user has provided custom instructions, follow them as long as they do not contradict the invoice.",
    ].join("\n"),
    contentBlocks: [...buildInvoiceContentBlocks(file, extractedText), ...(instructionBlock ? [{ type: "text", text: instructionBlock }] : [])],
  });

  return normalizeInvoice(structured);
}

async function reviseInvoice(invoice, userInstructions = "") {
  const safeInstructions = sanitizeUserInstructions(userInstructions);

  if (!safeInstructions) {
    throw new AppError("Add instructions for the AI assistant before revising the invoice output.", 400);
  }

  const normalizedInvoice = normalizeInvoice(invoice || {});
  const structured = await requestStructuredJson({
    systemPrompt: [
      "You are an expert Indian accounting assistant revising already extracted invoice data.",
      "You will receive an existing invoice JSON plus user instructions.",
      "Return valid JSON with the exact same shape and keys as the original invoice schema.",
      "Apply only changes justified by the user's instructions.",
      "Preserve values that do not need to change.",
      "Use confidence high, medium, or low and add concise review notes for anything still uncertain.",
      "Return JSON only.",
    ].join("\n"),
    contentBlocks: [
      {
        type: "text",
        text: `Current invoice JSON:\n${JSON.stringify(normalizedInvoice, null, 2)}`,
      },
      {
        type: "text",
        text: `User instructions:\n${safeInstructions}`,
      },
    ],
  });

  return normalizeInvoice({
    ...normalizedInvoice,
    ...structured,
    tallyConfig: {
      ...normalizedInvoice.tallyConfig,
      ...(structured.tallyConfig || {}),
    },
  });
}

module.exports = {
  extractInvoice,
  normalizeInvoice,
  reviseInvoice,
};

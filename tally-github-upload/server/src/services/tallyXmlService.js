const { defaultVoucherLedgers } = require("../constants/ledgerHeads");
const { cleanString, ensureArray, inferVoucherType, toFixedAmount, toIsoDate, toNumber } = require("../utils/normalizers");
const { amount, escapeXml, tallyDate, tag, wrapEnvelope } = require("../utils/xml");

function buildLedgerEntry({ ledgerName, amountValue, isDeemedPositive, extraTags = "" }) {
  return `            <ALLLEDGERENTRIES.LIST>
              ${tag("LEDGERNAME", ledgerName)}
              ${tag("ISDEEMEDPOSITIVE", isDeemedPositive ? "Yes" : "No")}
              ${tag("AMOUNT", amountValue)}
${extraTags}
            </ALLLEDGERENTRIES.LIST>`;
}

function buildInvoiceNarration(invoice) {
  const itemSummary = ensureArray(invoice.lineItems)
    .map((item) => {
      const bits = [cleanString(item.description)];
      if (cleanString(item.hsnSacCode)) {
        bits.push(`HSN/SAC ${cleanString(item.hsnSacCode)}`);
      }
      if (toNumber(item.quantity, 0) > 0) {
        bits.push(`Qty ${toFixedAmount(item.quantity)}`);
      }
      if (toNumber(item.rate, 0) > 0) {
        bits.push(`Rate ${toFixedAmount(item.rate)}`);
      }
      return bits.filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .join("; ");

  const segments = [
    cleanString(invoice.invoiceNumber) ? `Invoice ${cleanString(invoice.invoiceNumber)}` : "",
    itemSummary,
  ].filter(Boolean);

  return segments.join(" | ");
}

function buildInvoiceXml(invoice) {
  const companyName = cleanString(invoice.tallyConfig?.companyName);
  const purchaseLedgerName =
    cleanString(invoice.tallyConfig?.purchaseLedgerName) || defaultVoucherLedgers.purchaseLedgerName;
  const cgstLedgerName =
    cleanString(invoice.tallyConfig?.cgstLedgerName) || defaultVoucherLedgers.cgstLedgerName;
  const sgstLedgerName =
    cleanString(invoice.tallyConfig?.sgstLedgerName) || defaultVoucherLedgers.sgstLedgerName;
  const igstLedgerName =
    cleanString(invoice.tallyConfig?.igstLedgerName) || defaultVoucherLedgers.igstLedgerName;
  const vendorName = cleanString(invoice.vendorName) || "Unknown Vendor";
  const subtotal = toFixedAmount(invoice.subtotal);
  const cgst = toFixedAmount(invoice.cgst);
  const sgst = toFixedAmount(invoice.sgst);
  const igst = toFixedAmount(invoice.igst);
  const total = toFixedAmount(invoice.total || subtotal + cgst + sgst + igst);
  const dueDate = tallyDate(invoice.dueDate);

  const ledgerEntries = [
    buildLedgerEntry({
      ledgerName: vendorName,
      amountValue: `-${amount(total)}`,
      isDeemedPositive: true,
      extraTags: [
        `              ${tag("ISPARTYLEDGER", "Yes")}`,
        `              ${tag("ASORIGINAL", "Yes")}`,
      ].join("\n"),
    }),
    buildLedgerEntry({
      ledgerName: purchaseLedgerName,
      amountValue: amount(subtotal),
      isDeemedPositive: false,
    }),
  ];

  if (cgst > 0) {
    ledgerEntries.push(
      buildLedgerEntry({
        ledgerName: cgstLedgerName,
        amountValue: amount(cgst),
        isDeemedPositive: false,
      })
    );
  }

  if (sgst > 0) {
    ledgerEntries.push(
      buildLedgerEntry({
        ledgerName: sgstLedgerName,
        amountValue: amount(sgst),
        isDeemedPositive: false,
      })
    );
  }

  if (igst > 0) {
    ledgerEntries.push(
      buildLedgerEntry({
        ledgerName: igstLedgerName,
        amountValue: amount(igst),
        isDeemedPositive: false,
      })
    );
  }

  const message = `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
            ${tag("DATE", tallyDate(invoice.invoiceDate) || tallyDate(new Date().toISOString().slice(0, 10)))}
            ${tag("VOUCHERTYPENAME", "Purchase")}
            ${tag("PERSISTEDVIEW", "Accounting Voucher View")}
            ${tag("PARTYNAME", vendorName)}
            ${tag("BASICBASEPARTYNAME", vendorName)}
            ${tag("VOUCHERNUMBER", cleanString(invoice.invoiceNumber))}
            ${tag("REFERENCE", cleanString(invoice.invoiceNumber))}
            ${tag("NARRATION", buildInvoiceNarration(invoice))}
            ${tag("PARTYGSTIN", cleanString(invoice.vendorGstin))}
            ${dueDate ? tag("BASICDUEDATEOFPYMT", dueDate) : ""}
${ledgerEntries.join("\n")}
          </VOUCHER>
        </TALLYMESSAGE>`;

  return wrapEnvelope([message], companyName);
}

function resolveCounterLedgerAmount(transaction) {
  const debit = toFixedAmount(transaction.debit);
  const credit = toFixedAmount(transaction.credit);
  return debit > 0 ? debit : credit;
}

function buildBankVoucherMessage(transaction, bankLedgerName) {
  const voucherType = cleanString(transaction.voucherType) || inferVoucherType(transaction);
  const effectiveVoucherType =
    voucherType === "Payment" || voucherType === "Receipt" || voucherType === "Contra"
      ? voucherType
      : "Payment";
  const entryAmount = resolveCounterLedgerAmount(transaction);
  const ledgerHead = cleanString(transaction.ledgerHead) || "Suspense A/c";
  let debitAccount = cleanString(transaction.debitAccount);
  let creditAccount = cleanString(transaction.creditAccount);
  const voucherDate = tallyDate(transaction.date) || tallyDate(new Date().toISOString().slice(0, 10));

  let primaryEntry = "";
  let bankEntry = "";

  if (!debitAccount || !creditAccount) {
    if (effectiveVoucherType === "Receipt") {
      debitAccount = debitAccount || bankLedgerName;
      creditAccount = creditAccount || ledgerHead;
    } else {
      debitAccount = debitAccount || ledgerHead;
      creditAccount = creditAccount || bankLedgerName;
    }
  }

  if (effectiveVoucherType === "Receipt" && debitAccount === bankLedgerName) {
    primaryEntry = buildLedgerEntry({
      ledgerName: creditAccount,
      amountValue: `-${amount(entryAmount)}`,
      isDeemedPositive: true,
    });
    bankEntry = buildLedgerEntry({
      ledgerName: debitAccount,
      amountValue: amount(entryAmount),
      isDeemedPositive: false,
    });
  } else {
    primaryEntry = buildLedgerEntry({
      ledgerName: debitAccount,
      amountValue: amount(entryAmount),
      isDeemedPositive: false,
    });
    bankEntry = buildLedgerEntry({
      ledgerName: creditAccount,
      amountValue: `-${amount(entryAmount)}`,
      isDeemedPositive: true,
    });
  }

  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(effectiveVoucherType)}" ACTION="Create">
            ${tag("DATE", voucherDate)}
            ${tag("VOUCHERTYPENAME", effectiveVoucherType)}
            ${tag("VOUCHERNUMBER", cleanString(transaction.id))}
            ${tag("REFERENCE", cleanString(transaction.reference))}
            ${tag("NARRATION", cleanString(transaction.narration))}
${primaryEntry}
${bankEntry}
          </VOUCHER>
        </TALLYMESSAGE>`;
}

function buildBankStatementXml(statement) {
  const companyName = cleanString(statement.tallyConfig?.companyName);
  const bankLedgerName =
    cleanString(statement.tallyConfig?.bankLedgerName) || defaultVoucherLedgers.bankLedgerName;
  const transactions = ensureArray(statement.transactions);
  const messages = transactions.map((transaction) => buildBankVoucherMessage(transaction, bankLedgerName));

  return wrapEnvelope(messages, companyName);
}

module.exports = {
  buildBankStatementXml,
  buildInvoiceXml,
};

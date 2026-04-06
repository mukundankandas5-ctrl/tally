import { useMemo, useState } from "react";
import ConfidenceBadge from "./ConfidenceBadge";
import FileDropzone from "./FileDropzone";
import SectionCard from "./SectionCard";
import StatCard from "./StatCard";

import { downloadBlob } from "../utils/download";
import { exportInvoice, reviseInvoice, uploadInvoice } from "../utils/api";
import { formatCurrency, formatNumber } from "../utils/formatters";

function recalculateInvoice(invoice) {
  const lineItems = (invoice.lineItems || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount = Number(item.amount || 0);
    return {
      ...item,
      quantity,
      rate,
      amount,
    };
  });

  const computedSubtotal = Number(lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
  const subtotal = Number(
    Number(invoice.subtotal !== undefined && invoice.subtotal !== null ? invoice.subtotal : computedSubtotal).toFixed(2)
  );
  const cgst = Number(Number(invoice.cgst || 0).toFixed(2));
  const sgst = Number(Number(invoice.sgst || 0).toFixed(2));
  const igst = Number(Number(invoice.igst || 0).toFixed(2));
  const total = Number((subtotal + cgst + sgst + igst).toFixed(2));

  return {
    ...invoice,
    subtotal,
    total,
    lineItems,
  };
}

function toInputNumber(value) {
  return Number.isFinite(Number(value)) ? value : 0;
}

export default function InvoiceWorkflow({ defaults, initialState }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [invoice, setInvoice] = useState(initialState);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [error, setError] = useState("");

  const summaryCards = useMemo(
    () => [
      { label: "Subtotal", value: formatCurrency(invoice.subtotal), tone: "default" },
      { label: "CGST + SGST", value: formatCurrency(Number(invoice.cgst || 0) + Number(invoice.sgst || 0)), tone: "teal" },
      { label: "IGST", value: formatCurrency(invoice.igst), tone: "amber" },
      { label: "Grand Total", value: formatCurrency(invoice.total), tone: "rose" },
    ],
    [invoice]
  );

  const handleExtract = async () => {
    if (!selectedFile) {
      setError("Choose a JPG, PNG, or PDF invoice before extracting.");
      return;
    }

    try {
      setError("");
      setIsUploading(true);
      const payload = await uploadInvoice(selectedFile, assistantPrompt);
      setInvoice(recalculateInvoice(payload));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };



  const updateInvoiceField = (field, value) => {
    setInvoice((current) =>
      recalculateInvoice({
        ...current,
        [field]: value,
      })
    );
  };

  const updateConfigField = (field, value) => {
    setInvoice((current) => ({
      ...current,
      tallyConfig: {
        ...current.tallyConfig,
        [field]: value,
      },
    }));
  };

  const updateLineItem = (lineId, field, value) => {
    setInvoice((current) => {
      const nextItems = current.lineItems.map((item) => {
        if (item.id !== lineId) return item;

        const nextItem = {
          ...item,
          [field]: field === "description" || field === "hsnSacCode" ? value : Number(value || 0),
        };

        if (field === "quantity" || field === "rate") {
          nextItem.amount = Number((Number(nextItem.quantity || 0) * Number(nextItem.rate || 0)).toFixed(2));
        }

        return nextItem;
      });

      return recalculateInvoice({
        ...current,
        lineItems: nextItems,
      });
    });
  };

  const addLineItem = () => {
    setInvoice((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          id: `line-${current.lineItems.length + 1}`,
          description: "",
          hsnSacCode: "",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ],
    }));
  };

  const removeLineItem = (lineId) => {
    setInvoice((current) =>
      recalculateInvoice({
        ...current,
        lineItems: current.lineItems.filter((item) => item.id !== lineId),
      })
    );
  };

  const handleExport = async () => {
    try {
      setError("");
      setIsExporting(true);
      const blob = await exportInvoice(invoice);
      const filename = `${invoice.invoiceNumber || "purchase-voucher"}.xml`.replace(/\s+/g, "-");
      downloadBlob(blob, filename);
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAiRevision = async () => {
    if (!assistantPrompt.trim()) {
      setError("Add a short instruction for the AI assistant before applying changes.");
      return;
    }

    try {
      setError("");
      setIsRevising(true);
      const payload = await reviseInvoice(invoice, assistantPrompt);
      setInvoice(recalculateInvoice(payload));
    } catch (revisionError) {
      setError(revisionError.message);
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Invoice Processor"
        subtitle="Upload a photographed or scanned invoice, review Claude’s extracted fields, then export a Tally Purchase voucher XML."
        actions={
          <button
              type="button"
              onClick={handleExtract}
              disabled={isUploading}
              className="rounded-2xl bg-sea px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isUploading ? "Extracting..." : "Extract Invoice"}
            </button>
        }
      >
        <FileDropzone
          title="Invoice upload"
          description="Supports JPG, PNG, and PDF invoices. Upload a file and click Extract Invoice to begin."
          accept=".jpg,.jpeg,.png,.pdf"
          selectedFile={selectedFile}
          onFileSelected={setSelectedFile}
          buttonLabel="Upload invoice"
        />

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {summaryCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <label className="label-base">AI Assistant Instructions</label>
          <textarea
            className="input-base min-h-[110px]"
            placeholder="Example: Treat freight as a separate line item, set confidence low if GSTIN is unclear, and prefer due date only when explicitly shown."
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAiRevision}
              disabled={isRevising}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRevising ? "Applying AI Changes..." : "Apply AI Changes"}
            </button>
            <p className="text-sm text-slate-500">
              Use this to tell the assistant how to revise the current output or how to behave during the next extraction.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard
          title="Review & Edit"
          subtitle="Correct anything Claude missed before exporting the voucher."
          actions={<ConfidenceBadge confidence={invoice.confidence} />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-base">Vendor Name</label>
              <input className="input-base" value={invoice.vendorName} onChange={(event) => updateInvoiceField("vendorName", event.target.value)} />
            </div>
            <div>
              <label className="label-base">Vendor GSTIN</label>
              <input className="input-base" value={invoice.vendorGstin} onChange={(event) => updateInvoiceField("vendorGstin", event.target.value)} />
            </div>
            <div>
              <label className="label-base">Invoice Number</label>
              <input className="input-base" value={invoice.invoiceNumber} onChange={(event) => updateInvoiceField("invoiceNumber", event.target.value)} />
            </div>
            <div>
              <label className="label-base">Invoice Date</label>
              <input className="input-base" type="date" value={invoice.invoiceDate} onChange={(event) => updateInvoiceField("invoiceDate", event.target.value)} />
            </div>
            <div>
              <label className="label-base">Due Date</label>
              <input className="input-base" type="date" value={invoice.dueDate} onChange={(event) => updateInvoiceField("dueDate", event.target.value)} />
            </div>
            <div>
              <label className="label-base">Subtotal</label>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={toInputNumber(invoice.subtotal)}
                onChange={(event) => updateInvoiceField("subtotal", Number(event.target.value))}
              />
            </div>
            <div>
              <label className="label-base">CGST</label>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={toInputNumber(invoice.cgst)}
                onChange={(event) => updateInvoiceField("cgst", Number(event.target.value))}
              />
            </div>
            <div>
              <label className="label-base">SGST</label>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={toInputNumber(invoice.sgst)}
                onChange={(event) => updateInvoiceField("sgst", Number(event.target.value))}
              />
            </div>
            <div>
              <label className="label-base">IGST</label>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={toInputNumber(invoice.igst)}
                onChange={(event) => updateInvoiceField("igst", Number(event.target.value))}
              />
            </div>
            <div>
              <label className="label-base">Grand Total</label>
              <input className="input-base" type="number" step="0.01" value={toInputNumber(invoice.total)} readOnly />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
                <p className="mt-1 text-sm text-slate-500">Update descriptions, HSN/SAC codes, quantities, rates, and amounts before export.</p>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Add line
              </button>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full bg-white">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-head">Description</th>
                    <th className="table-head">HSN/SAC</th>
                    <th className="table-head">Qty</th>
                    <th className="table-head">Rate</th>
                    <th className="table-head">Amount</th>
                    <th className="table-head">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="table-cell">
                        <input className="input-base" value={item.description} onChange={(event) => updateLineItem(item.id, "description", event.target.value)} />
                      </td>
                      <td className="table-cell">
                        <input className="input-base" value={item.hsnSacCode} onChange={(event) => updateLineItem(item.id, "hsnSacCode", event.target.value)} />
                      </td>
                      <td className="table-cell">
                        <input className="input-base" type="number" step="0.01" value={toInputNumber(item.quantity)} onChange={(event) => updateLineItem(item.id, "quantity", event.target.value)} />
                      </td>
                      <td className="table-cell">
                        <input className="input-base" type="number" step="0.01" value={toInputNumber(item.rate)} onChange={(event) => updateLineItem(item.id, "rate", event.target.value)} />
                      </td>
                      <td className="table-cell">
                        <input className="input-base" type="number" step="0.01" value={toInputNumber(item.amount)} onChange={(event) => updateLineItem(item.id, "amount", event.target.value)} />
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Tally Export"
          subtitle="Set the target company and ledger names used in the generated Purchase voucher XML."
          actions={
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-2xl bg-slateblue px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isExporting ? "Preparing XML..." : "Download XML"}
            </button>
          }
        >
          <div className="grid gap-4">
            <div>
              <label className="label-base">Tally Company Name</label>
              <input className="input-base" value={invoice.tallyConfig.companyName} onChange={(event) => updateConfigField("companyName", event.target.value)} placeholder="Optional: exact company name in Tally" />
            </div>
            <div>
              <label className="label-base">Purchase Ledger</label>
              <input className="input-base" value={invoice.tallyConfig.purchaseLedgerName} onChange={(event) => updateConfigField("purchaseLedgerName", event.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label-base">CGST Ledger</label>
                <input className="input-base" value={invoice.tallyConfig.cgstLedgerName} onChange={(event) => updateConfigField("cgstLedgerName", event.target.value)} />
              </div>
              <div>
                <label className="label-base">SGST Ledger</label>
                <input className="input-base" value={invoice.tallyConfig.sgstLedgerName} onChange={(event) => updateConfigField("sgstLedgerName", event.target.value)} />
              </div>
              <div>
                <label className="label-base">IGST Ledger</label>
                <input className="input-base" value={invoice.tallyConfig.igstLedgerName} onChange={(event) => updateConfigField("igstLedgerName", event.target.value)} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-slate-900 p-5 text-sm text-slate-200">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Export Preview</div>
            <div className="mt-3 space-y-2">
              <p>Voucher Type: Purchase</p>
              <p>Vendor: {invoice.vendorName || "Unknown Vendor"}</p>
              <p>Total Amount: {formatCurrency(invoice.total)}</p>
              <p>Line Items: {formatNumber(invoice.lineItems.length)}</p>
            </div>
          </div>

          {invoice.reviewNotes?.length ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">AI Review Notes</div>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {invoice.reviewNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

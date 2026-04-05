import { useEffect, useState } from "react";
import BankStatementWorkflow from "./components/BankStatementWorkflow";
import InvoiceWorkflow from "./components/InvoiceWorkflow";
import WorkflowTabButton from "./components/WorkflowTabButton";
import { createEmptyBankStatement, createEmptyInvoice } from "./constants/defaults";
import { fetchLedgers } from "./utils/api";

const tabs = [
  {
    id: "invoice",
    title: "Invoice Processor",
    description: "Extract purchase invoices and export Tally Purchase XML.",
  },
  {
    id: "bank",
    title: "Ledger Mapper",
    description: "Classify bank entries and export voucher-ready XML.",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("invoice");
  const [ledgerHeads, setLedgerHeads] = useState([]);
  const [defaults, setDefaults] = useState({
    purchaseLedgerName: "Purchase A/c",
    cgstLedgerName: "Input CGST",
    sgstLedgerName: "Input SGST",
    igstLedgerName: "Input IGST",
    bankLedgerName: "Bank Account",
  });
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetchLedgers()
      .then((payload) => {
        if (!mounted) return;
        setLedgerHeads(payload.ledgerHeads || []);
        setDefaults((current) => ({
          ...current,
          ...(payload.defaults || {}),
        }));
      })
      .catch((error) => {
        if (!mounted) return;
        setBootError(error.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="panel-blur animate-rise rounded-[36px] border border-white/80 px-6 py-8 shadow-panel sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sea">Tally ERP AI Assistant</p>
            <h1 className="font-display mt-4 text-4xl leading-tight text-slate-900 sm:text-5xl">
              Faster invoice entry and cleaner ledger mapping for Indian accounting teams.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
              Upload invoices, parse bank statements, review AI confidence, and generate Tally-compatible XML that’s ready
              for Gateway of Tally import workflows.
            </p>
            <p className="mt-3 text-sm font-medium text-sea">
              Prototype mode is ready now: run the app and use the Load Demo Data buttons without configuring Anthropic first.
            </p>
          </div>

          <div className="grid gap-4 rounded-[28px] bg-slate-900 p-6 text-slate-100">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Built for daily ops</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                OCR-assisted invoice capture, editable ledger review, Indian currency formatting, and XML exports shaped for
                Tally ERP 9 and TallyPrime.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 p-4">Claude stays on the backend only.</div>
              <div className="rounded-2xl border border-slate-700 p-4">Scanned bank PDFs return clear OCR guidance.</div>
            </div>
          </div>
        </div>
      </header>

      {bootError ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{bootError}</div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {tabs.map((tab) => (
          <WorkflowTabButton
            key={tab.id}
            active={activeTab === tab.id}
            title={tab.title}
            description={tab.description}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <main className="mt-8">
        {activeTab === "invoice" ? (
          <InvoiceWorkflow defaults={defaults} initialState={createEmptyInvoice(defaults)} />
        ) : (
          <BankStatementWorkflow ledgerHeads={ledgerHeads} initialState={createEmptyBankStatement(defaults)} />
        )}
      </main>
    </div>
  );
}

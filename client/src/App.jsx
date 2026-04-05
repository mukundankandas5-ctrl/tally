import { useEffect, useState } from "react";
import { createDemoBankStatement, createDemoInvoice } from "./constants/sampleData";
import {
  analyzeRecommendations,
  downloadBankStatementXml,
  downloadGstWorkbook,
  downloadInvoiceXml,
  downloadRecommendationXml,
  fetchClients,
  fetchLedgers,
  fetchTallyStatus,
  pushBankStatementToTally,
  pushInvoiceToTally,
  reconcileGst,
  testTallyConnection,
  uploadBankStatement,
  uploadInvoice,
} from "./utils/api";
import { downloadBlob } from "./utils/download";
import { confidenceClassNames, formatCurrency, formatDate, formatNumber } from "./utils/formatters";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "bank", label: "Bank Processor", icon: "bank" },
  { id: "invoice", label: "Invoice Processor", icon: "invoice" },
  { id: "recommendations", label: "Speedy Recommendations", icon: "spark" },
  { id: "gst", label: "GST Reconciliation", icon: "shield" },
  { id: "tally", label: "Tally Connection", icon: "plug" },
  { id: "clients", label: "Client Manager", icon: "users" },
];

const quickActions = [
  { id: "bank", label: "Upload Bank Statement" },
  { id: "invoice", label: "Upload Invoice" },
  { id: "tally", label: "Sync Tally" },
];

const statusTone = {
  matched: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20",
  partial: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/20",
  unmatched: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/20",
};

function Icon({ name, className = "h-5 w-5" }) {
  const icons = {
    home: (
      <path
        d="M3.75 10.5 12 3.75l8.25 6.75v8.25a1.5 1.5 0 0 1-1.5 1.5h-3.75V14.25h-6v6.75H5.25a1.5 1.5 0 0 1-1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    bank: (
      <>
        <path d="M3 9.75 12 4.5l9 5.25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4.5 10.5h15v1.5h-15zM6.75 12.75v5.25M10.5 12.75v5.25M13.5 12.75v5.25M17.25 12.75v5.25M3.75 18.75h16.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    invoice: (
      <>
        <path d="M7.5 3.75h6l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M13.5 3.75v4.5H18M9 12h6M9 15.75h6M9 19.5h3.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    spark: (
      <path d="m12 3 1.89 5.61L19.5 10.5l-5.61 1.89L12 18l-1.89-5.61L4.5 10.5l5.61-1.89L12 3Zm6.75 11.25.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1ZM5.25 14.25l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
    shield: (
      <path d="M12 3.75c2.5 1.75 5.5 2.25 7.5 2.25v5.4c0 4.28-2.8 8.2-7.5 9.85-4.7-1.65-7.5-5.57-7.5-9.85V6c2 0 5-.5 7.5-2.25Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    ),
    plug: (
      <path d="M9 3.75v5.25M15 3.75v5.25M8.25 9h7.5v3A4.5 4.5 0 0 1 11.25 16.5H10.5V20.25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
    users: (
      <>
        <path d="M9 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 12.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 19.5a4.5 4.5 0 0 1 9 0M14.25 19.5a3.75 3.75 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    bell: (
      <path d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.63c0 .8.3 1.57.84 2.13l.78.8H5.88l.78-.8c.54-.56.84-1.33.84-2.13V9A4.5 4.5 0 0 1 12 4.5Zm-1.88 12.75a1.88 1.88 0 0 0 3.76 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function StatCard({ label, value, helper, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-500/20 to-sky-500/5 text-blue-100",
    green: "from-emerald-500/20 to-emerald-500/5 text-emerald-100",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-100",
    slate: "from-white/10 to-white/5 text-white",
  };

  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${toneMap[tone]} p-5 shadow-soft`}>
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function SectionCard({ title, kicker, actions, children }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white p-6 shadow-card">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {kicker ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{kicker}</p> : null}
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function ModuleHeader({ title, description }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Automation workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function Pill({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function Button({ children, variant = "primary", ...props }) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    dark: "bg-white/10 text-white hover:bg-white/15",
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-60`}
      {...props}
    >
      {children}
    </button>
  );
}

function FileInput({ label, accept, onChange, helper }) {
  return (
    <label className="flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-2 max-w-sm text-sm text-slate-500">{helper}</span>
      <span className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">Choose file</span>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function ConfidenceDot({ value }) {
  const color = value === "high" ? "bg-emerald-500" : value === "medium" ? "bg-amber-400" : "bg-rose-500";
  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${color}`} />;
}

export default function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [bootError, setBootError] = useState("");
  const [busy, setBusy] = useState("");
  const [ledgerHeads, setLedgerHeads] = useState([]);
  const [defaults, setDefaults] = useState({
    purchaseLedgerName: "Purchase A/c",
    cgstLedgerName: "Input CGST",
    sgstLedgerName: "Input SGST",
    igstLedgerName: "Input IGST",
    bankLedgerName: "Bank Account",
  });
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState("aurora");
  const [tallyConfig, setTallyConfig] = useState({
    host: "localhost",
    port: "9000",
    companyName: "",
  });
  const [tallyStatus, setTallyStatus] = useState({
    connected: false,
    lastSyncAt: "",
    lastEntryCount: 0,
    lastMessage: "No sync has been run yet.",
  });
  const [bankStatement, setBankStatement] = useState(createDemoBankStatement({}));
  const [invoice, setInvoice] = useState(createDemoInvoice({}));
  const [recommendations, setRecommendations] = useState({
    confidence: "medium",
    summary: { totalRows: 0, acceptedCount: 0, needsReviewCount: 0 },
    mappings: [],
    learningSummary: { learnedRuleCount: 0, recentInstructions: [] },
    tallyConfig: { companyName: "", bankLedgerName: "Bank Account" },
  });
  const [gstReport, setGstReport] = useState({
    summary: { matched: 0, partial: 0, unmatched: 0, total: 0 },
    rows: [],
  });
  const [bankReviewOnly, setBankReviewOnly] = useState(false);
  const [activity, setActivity] = useState([
    { id: "a1", title: "March SBI statement classified", time: "2 min ago", detail: "124 rows mapped, 9 need review." },
    { id: "a2", title: "Bluewave purchase invoice exported", time: "24 min ago", detail: "Voucher draft generated with GST split." },
    { id: "a3", title: "Tally sync completed", time: "1 hr ago", detail: "36 entries pushed to Aurora Traders LLP." },
  ]);

  useEffect(() => {
    let active = true;

    Promise.all([fetchLedgers(), fetchClients(), fetchTallyStatus()])
      .then(([ledgerPayload, clientPayload, tallyPayload]) => {
        if (!active) return;
        setLedgerHeads(ledgerPayload.ledgerHeads || []);
        setDefaults((current) => ({ ...current, ...(ledgerPayload.defaults || {}) }));
        setClients(clientPayload.clients || []);
        setTallyStatus(tallyPayload);
      })
      .catch((error) => {
        if (!active) return;
        setBootError(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setInvoice((current) => ({
      ...current,
      tallyConfig: {
        ...current.tallyConfig,
        purchaseLedgerName: current.tallyConfig.purchaseLedgerName || defaults.purchaseLedgerName,
        cgstLedgerName: current.tallyConfig.cgstLedgerName || defaults.cgstLedgerName,
        sgstLedgerName: current.tallyConfig.sgstLedgerName || defaults.sgstLedgerName,
        igstLedgerName: current.tallyConfig.igstLedgerName || defaults.igstLedgerName,
      },
    }));

    setBankStatement((current) => ({
      ...current,
      tallyConfig: {
        ...current.tallyConfig,
        bankLedgerName: current.tallyConfig.bankLedgerName || defaults.bankLedgerName,
      },
    }));

    setRecommendations((current) => ({
      ...current,
      tallyConfig: {
        ...current.tallyConfig,
        bankLedgerName: current.tallyConfig.bankLedgerName || defaults.bankLedgerName,
      },
    }));
  }, [defaults]);

  const activeClient = clients.find((client) => client.id === activeClientId) || clients[0];
  const bankRows = bankReviewOnly
    ? bankStatement.transactions.filter((item) => item.needsReview || item.confidence === "low")
    : bankStatement.transactions;
  const entriesProcessedToday = bankStatement.transactions.length + recommendations.summary.acceptedCount + (invoice.invoiceNumber ? 1 : 0);
  const hoursSaved = ((bankStatement.transactions.length * 3.2 + recommendations.summary.acceptedCount * 1.4 + invoice.lineItems.length * 2.8) / 60).toFixed(1);
  const pendingReviewCount =
    bankStatement.summary.reviewCount + recommendations.summary.needsReviewCount + gstReport.summary.partial + gstReport.summary.unmatched;
  const highConfidenceCount =
    bankStatement.transactions.filter((item) => item.confidence === "high").length +
    recommendations.mappings.filter((item) => item.suggestion?.confidence === "high").length +
    (invoice.confidence === "high" ? 1 : 0);
  const totalQualityItems = bankStatement.transactions.length + recommendations.mappings.length + 1;
  const accuracyRate = totalQualityItems ? `${((highConfidenceCount / totalQualityItems) * 100).toFixed(1)}%` : "0%";

  function addActivity(title, detail) {
    setActivity((current) => [
      {
        id: `${Date.now()}`,
        title,
        detail,
        time: "Just now",
      },
      ...current,
    ]);
  }

  async function withBusy(key, task) {
    setBusy(key);
    setBootError("");
    try {
      await task();
    } catch (error) {
      setBootError(error.message);
    } finally {
      setBusy("");
    }
  }

  function syncCompanyName(payload) {
    return {
      ...payload,
      tallyConfig: {
        ...(payload.tallyConfig || {}),
        companyName: tallyConfig.companyName,
      },
    };
  }

  function updateBankTransaction(id, field, value) {
    setBankStatement((current) => {
      const transactions = current.transactions.map((item) =>
        item.id === id ? { ...item, [field]: value, needsReview: field === "ledgerHead" ? false : item.needsReview } : item
      );
      return {
        ...current,
        transactions,
        summary: {
          ...current.summary,
          reviewCount: transactions.filter((item) => item.needsReview || item.confidence === "low").length,
        },
      };
    });
  }

  function approveHighConfidenceRows() {
    setBankStatement((current) => {
      const transactions = current.transactions.map((item) =>
        item.confidence === "high" ? { ...item, needsReview: false } : item
      );
      return {
        ...current,
        transactions,
        summary: {
          ...current.summary,
          reviewCount: transactions.filter((item) => item.needsReview || item.confidence === "low").length,
        },
      };
    });
    addActivity("High-confidence bank rows approved", "All green-confidence transactions were marked ready for export.");
  }

  function updateInvoiceField(field, value) {
    setInvoice((current) => ({ ...current, [field]: value }));
  }

  function updateInvoiceLine(id, field, value) {
    setInvoice((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function updateRecommendation(id, patch) {
    setRecommendations((current) => {
      const mappings = current.mappings.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return {
        ...current,
        mappings,
        summary: {
          ...current.summary,
          acceptedCount: mappings.filter((item) => item.accepted).length,
          needsReviewCount: mappings.filter((item) => item.suggestion?.confidence === "low").length,
        },
      };
    });
  }

  async function handleBankUpload(file) {
    await withBusy("bank-upload", async () => {
      const payload = await uploadBankStatement(file);
      const statement = syncCompanyName(payload);
      setBankStatement(statement);
      setActiveModule("bank");
      addActivity("Bank statement processed", `${statement.transactions.length} rows extracted from ${file.name}.`);
    });
  }

  async function handleInvoiceUpload(file) {
    await withBusy("invoice-upload", async () => {
      const payload = await uploadInvoice(file);
      const nextInvoice = syncCompanyName(payload);
      setInvoice(nextInvoice);
      setActiveModule("invoice");
      addActivity("Invoice captured", `${nextInvoice.invoiceNumber || file.name} extracted and staged for review.`);
    });
  }

  async function handleRecommendationUpload(file) {
    await withBusy("recommendation-upload", async () => {
      const payload = await analyzeRecommendations(file);
      const nextRecommendations = syncCompanyName(payload);
      setRecommendations(nextRecommendations);
      setActiveModule("recommendations");
      addActivity("Speedy recommendations prepared", `${nextRecommendations.summary.totalRows} rows analyzed from ${file.name}.`);
    });
  }

  async function handleGstReconcile(gstr2bFile, purchaseRegisterFile) {
    await withBusy("gst-reconcile", async () => {
      const payload = await reconcileGst(gstr2bFile, purchaseRegisterFile);
      setGstReport(payload);
      setActiveModule("gst");
      addActivity("GST reconciliation completed", `${payload.summary.matched} matched and ${payload.summary.unmatched} unmatched entries found.`);
    });
  }

  async function handleInvoiceExport() {
    await withBusy("invoice-export", async () => {
      const blob = await downloadInvoiceXml(syncCompanyName(invoice));
      downloadBlob(blob, `${invoice.invoiceNumber || "purchase-voucher"}.xml`);
      addActivity("Invoice XML downloaded", "Purchase voucher XML is ready for Tally import.");
    });
  }

  async function handleBankExport() {
    await withBusy("bank-export", async () => {
      const blob = await downloadBankStatementXml(syncCompanyName(bankStatement));
      downloadBlob(blob, "bank-vouchers.xml");
      addActivity("Bank XML downloaded", "Voucher XML export completed for the current statement.");
    });
  }

  async function handleRecommendationExport() {
    await withBusy("recommendation-export", async () => {
      const blob = await downloadRecommendationXml(syncCompanyName(recommendations));
      downloadBlob(blob, "speedy-recommendations.xml");
      addActivity("Recommendation XML downloaded", "Accepted suggestions were converted into Tally-ready XML.");
    });
  }

  async function handleGstExport() {
    await withBusy("gst-export", async () => {
      const blob = await downloadGstWorkbook(gstReport);
      downloadBlob(blob, "gst-reconciliation.xlsx");
      addActivity("GST workbook exported", "Matched and mismatched rows were exported to Excel.");
    });
  }

  async function handleInvoicePush() {
    await withBusy("invoice-push", async () => {
      const payload = await pushInvoiceToTally(syncCompanyName(invoice), tallyConfig);
      setTallyStatus(payload.syncState);
      addActivity("Invoice pushed to Tally", payload.syncState.lastMessage);
    });
  }

  async function handleBankPush() {
    await withBusy("bank-push", async () => {
      const payload = await pushBankStatementToTally(syncCompanyName(bankStatement), tallyConfig);
      setTallyStatus(payload.syncState);
      addActivity("Bank vouchers pushed to Tally", payload.syncState.lastMessage);
    });
  }

  async function handleTallyTest() {
    await withBusy("tally-test", async () => {
      const payload = await testTallyConnection(tallyConfig);
      setTallyStatus(payload.syncState);
      addActivity("Tally connection tested", payload.syncState.lastMessage);
    });
  }

  const dashboardView = (
    <>
      <ModuleHeader
        title="AI-powered accounting cockpit for high-volume CA teams"
        description="A clean, operational dashboard for statement extraction, purchase entry, GST review, and one-click Tally posting across multiple clients."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Entries Processed Today" value={formatNumber(entriesProcessedToday)} helper="Across bank, invoice, and recommendation workflows" />
        <StatCard label="Hours Saved" value={`${hoursSaved} hrs`} helper="Estimated based on current automation throughput" tone="green" />
        <StatCard label="Pending Review" value={formatNumber(pendingReviewCount)} helper="Low-confidence or mismatched items needing attention" tone="rose" />
        <StatCard label="Accuracy Rate" value={accuracyRate} helper="Weighted from high-confidence extractions and mappings" tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard
          title="Operations Snapshot"
          kicker="Quick actions"
          actions={quickActions.map((action) => (
            <Button key={action.id} variant="ghost" onClick={() => setActiveModule(action.id)}>
              {action.label}
            </Button>
          ))}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] bg-slate-950 p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">Bank processor</div>
              <div className="mt-4 text-2xl font-semibold">{bankStatement.transactions.length}</div>
              <div className="mt-2 text-sm text-slate-400">Transactions extracted with {bankStatement.summary.reviewCount} rows still awaiting review.</div>
            </div>
            <div className="rounded-[24px] bg-slate-100 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Invoice processor</div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">{invoice.invoiceNumber || "Ready"}</div>
              <div className="mt-2 text-sm text-slate-500">{invoice.vendorName || "Upload an invoice image or PDF to begin extraction."}</div>
            </div>
            <div className="rounded-[24px] bg-slate-100 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Tally sync</div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">{tallyStatus.lastEntryCount || 0}</div>
              <div className="mt-2 text-sm text-slate-500">Entries in the last push. Current endpoint: {tallyConfig.host}:{tallyConfig.port}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity" kicker="Live feed">
          <div className="space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{item.time}</div>
                </div>
                <div className="mt-2 text-sm text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );

  const bankView = (
    <>
      <ModuleHeader
        title="Bank Statement Processor"
        description="Drop in any Indian bank PDF, classify every row to a Tally ledger, review the low-confidence items, and export XML or sync directly to TallyPrime."
      />
      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <SectionCard
          title="Upload And Controls"
          kicker="Input"
          actions={
            <>
              <Button variant="ghost" onClick={approveHighConfidenceRows}>
                Bulk approve high-confidence
              </Button>
              <Button variant="secondary" onClick={handleBankExport} disabled={!bankStatement.transactions.length || busy}>
                Export Tally XML
              </Button>
              <Button variant="primary" onClick={handleBankPush} disabled={!bankStatement.transactions.length || busy}>
                Push To Tally
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <FileInput
              label="Upload PDF bank statement"
              accept="application/pdf"
              helper="Supports text-based PDF statements. The backend sends the file to Claude through Anthropic, extracts each row, and classifies ledgers."
              onChange={handleBankUpload}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total debits</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(bankStatement.summary.totalDebits)}</div>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total credits</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(bankStatement.summary.totalCredits)}</div>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Needs review</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatNumber(bankStatement.summary.reviewCount)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={bankReviewOnly ? "secondary" : "ghost"} onClick={() => setBankReviewOnly((current) => !current)}>
                {bankReviewOnly ? "Showing only needs review" : "Filter needs review"}
              </Button>
              <Pill className={confidenceClassNames[bankStatement.confidence] || confidenceClassNames.medium}>
                Overall confidence: {bankStatement.confidence}
              </Pill>
            </div>
            {bankStatement.reviewNotes?.length ? (
              <div className="rounded-[24px] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Review notes</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {bankStatement.reviewNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Classified Transactions" kicker="Editable table">
          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Debit</th>
                    <th className="px-4 py-3">Credit</th>
                    <th className="px-4 py-3">Ledger</th>
                    <th className="px-4 py-3">Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {bankRows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ConfidenceDot value={row.confidence} />
                          <span className="capitalize text-slate-700">{row.confidence}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.date)}</td>
                      <td className="max-w-[280px] px-4 py-3 text-slate-700">{row.narration}</td>
                      <td className="px-4 py-3 font-medium text-rose-600">{row.debit ? formatCurrency(row.debit) : "—"}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{row.credit ? formatCurrency(row.credit) : "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          value={row.ledgerHead}
                          onChange={(event) => updateBankTransaction(row.id, "ledgerHead", event.target.value)}
                        >
                          {ledgerHeads.map((ledger) => (
                            <option key={ledger.name} value={ledger.name}>
                              {ledger.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          value={row.voucherType}
                          onChange={(event) => updateBankTransaction(row.id, "voucherType", event.target.value)}
                        >
                          <option value="Payment">Payment</option>
                          <option value="Receipt">Receipt</option>
                          <option value="Contra">Contra</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!bankRows.length ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                        No transactions match the current filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );

  const invoiceView = (
    <>
      <ModuleHeader
        title="Invoice / Purchase Entry Processor"
        description="Upload a scanned purchase invoice or paper photo, review extracted GST data in-place, and export or sync a purchase voucher directly into Tally."
      />
      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <SectionCard
          title="Document Intake"
          kicker="Upload"
          actions={
            <>
              <Button variant="secondary" onClick={handleInvoiceExport} disabled={busy}>
                Export Tally XML
              </Button>
              <Button variant="primary" onClick={handleInvoicePush} disabled={busy}>
                Push To Tally
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <FileInput
              label="Upload JPG, PNG, or scanned PDF"
              accept="application/pdf,image/png,image/jpeg"
              helper="The backend sends the invoice file to Claude and extracts vendor, invoice number, GST details, due date, line items, and voucher hints."
              onChange={handleInvoiceUpload}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Confidence</div>
                <div className="mt-3">
                  <Pill className={confidenceClassNames[invoice.confidence] || confidenceClassNames.medium}>{invoice.confidence}</Pill>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Voucher type</div>
                <div className="mt-3 text-xl font-semibold text-slate-950">{invoice.total > 0 ? "Purchase" : "Draft"}</div>
              </div>
            </div>
            {invoice.reviewNotes?.length ? (
              <div className="rounded-[24px] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Review notes</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {invoice.reviewNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Extracted Voucher Draft" kicker="Editable form">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Vendor name", "vendorName"],
              ["Invoice number", "invoiceNumber"],
              ["Invoice date", "invoiceDate"],
              ["Due date", "dueDate"],
              ["GSTIN", "vendorGstin"],
            ].map(([label, field]) => (
              <label key={field} className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
                <input
                  value={invoice[field]}
                  type={field.toLowerCase().includes("date") ? "date" : "text"}
                  onChange={(event) => updateInvoiceField(field, event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            {[
              ["Subtotal", "subtotal"],
              ["CGST", "cgst"],
              ["SGST", "sgst"],
              ["IGST", "igst"],
            ].map(([label, field]) => (
              <label key={field} className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
                <input
                  value={invoice[field]}
                  type="number"
                  onChange={(event) => updateInvoiceField(field, Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">HSN/SAC</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-3">
                      <input
                        value={item.description}
                        onChange={(event) => updateInvoiceLine(item.id, "description", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.hsnSacCode}
                        onChange={(event) => updateInvoiceLine(item.id, "hsnSacCode", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.quantity}
                        type="number"
                        onChange={(event) => updateInvoiceLine(item.id, "quantity", Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.rate}
                        type="number"
                        onChange={(event) => updateInvoiceLine(item.id, "rate", Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.amount}
                        type="number"
                        onChange={(event) => updateInvoiceLine(item.id, "amount", Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );

  const recommendationView = (
    <>
      <ModuleHeader
        title="Speedy Recommendations"
        description="Upload a Tally or bank Excel export, review AI-suggested ledger mappings in bulk, preserve accepted mappings for future runs, and push approved rows into Tally."
      />
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <SectionCard
          title="Bulk Recommendation Intake"
          kicker="Excel upload"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  setRecommendations((current) => ({
                    ...current,
                    mappings: current.mappings.map((item) => ({ ...item, accepted: true })),
                    summary: { ...current.summary, acceptedCount: current.mappings.length },
                  }))
                }
              >
                Accept all
              </Button>
              <Button variant="secondary" onClick={handleRecommendationExport} disabled={!recommendations.mappings.length || busy}>
                Export XML
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <FileInput
              label="Upload Tally or bank Excel"
              accept=".xlsx,.xls,.csv"
              helper="The backend parses the first sheet, applies learned mappings, and uses Anthropic suggestions when available."
              onChange={handleRecommendationUpload}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rows analyzed</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatNumber(recommendations.summary.totalRows)}</div>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Accepted</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatNumber(recommendations.summary.acceptedCount)}</div>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Needs review</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{formatNumber(recommendations.summary.needsReviewCount)}</div>
              </div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
              Learned mappings stored locally: <span className="font-semibold text-slate-900">{recommendations.learningSummary.learnedRuleCount}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Suggested Mappings" kicker="Split review">
          <div className="space-y-4">
            {recommendations.mappings.map((item) => (
              <div key={item.id} className="grid gap-4 rounded-[24px] border border-slate-200 p-4 lg:grid-cols-[1.1fr_0.9fr_auto]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{formatDate(item.date)}</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{item.description}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Debit {formatCurrency(item.debit)} • Credit {formatCurrency(item.credit)}
                  </div>
                </div>
                <div className="space-y-3">
                  <select
                    value={item.suggestion.ledgerHead}
                    onChange={(event) =>
                      updateRecommendation(item.id, {
                        suggestion: {
                          ...item.suggestion,
                          ledgerHead: event.target.value,
                        },
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {ledgerHeads.map((ledger) => (
                      <option key={ledger.name} value={ledger.name}>
                        {ledger.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3">
                    <Pill className={confidenceClassNames[item.suggestion.confidence] || confidenceClassNames.medium}>
                      {item.suggestion.confidence}
                    </Pill>
                    <span className="text-xs text-slate-500">{item.suggestion.rationale}</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <Button variant={item.accepted ? "primary" : "ghost"} onClick={() => updateRecommendation(item.id, { accepted: !item.accepted })}>
                    {item.accepted ? "Accepted" : "Rejected"}
                  </Button>
                </div>
              </div>
            ))}
            {!recommendations.mappings.length ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-slate-400">
                Upload an Excel file to start bulk ledger suggestions.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </>
  );

  const gstView = (
    <>
      <ModuleHeader
        title="GST Reconciliation"
        description="Compare GSTR-2B against the purchase register, highlight matched, partially matched, and unmatched rows, then export a workbook for follow-up."
      />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionCard
          title="Reconciliation Inputs"
          kicker="Source files"
          actions={
            <Button variant="secondary" onClick={handleGstExport} disabled={!gstReport.rows.length || busy}>
              Export Excel Report
            </Button>
          }
        >
          <GstUploader onSubmit={handleGstReconcile} busy={busy} />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Matched</div>
              <div className="mt-3 text-2xl font-semibold text-emerald-900">{formatNumber(gstReport.summary.matched)}</div>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Partial</div>
              <div className="mt-3 text-2xl font-semibold text-amber-900">{formatNumber(gstReport.summary.partial)}</div>
            </div>
            <div className="rounded-3xl bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Unmatched</div>
              <div className="mt-3 text-2xl font-semibold text-rose-900">{formatNumber(gstReport.summary.unmatched)}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Match Results" kicker="Color-coded rows">
          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {gstReport.rows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-3">
                        <Pill className={statusTone[row.status]}>{row.status}</Pill>
                      </td>
                      <td className="px-4 py-3 text-slate-900">{row.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{row.gstin || "—"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-4 py-3 text-slate-500">{row.mismatchReason}</td>
                    </tr>
                  ))}
                  {!gstReport.rows.length ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                        Upload GSTR-2B and purchase register files to generate the reconciliation view.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );

  const tallyView = (
    <>
      <ModuleHeader
        title="Tally Connection Panel"
        description="Configure the TallyPrime HTTP endpoint, test connectivity against the local XML listener, and see the latest sync state before pushing vouchers."
      />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionCard
          title="Connection Settings"
          kicker="HTTP bridge"
          actions={
            <Button variant="primary" onClick={handleTallyTest} disabled={busy}>
              Test connection
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tally server IP</span>
              <input
                value={tallyConfig.host}
                onChange={(event) => setTallyConfig((current) => ({ ...current, host: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Port</span>
              <input
                value={tallyConfig.port}
                onChange={(event) => setTallyConfig((current) => ({ ...current, port: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Company name</span>
              <input
                value={tallyConfig.companyName}
                onChange={(event) => setTallyConfig((current) => ({ ...current, companyName: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Sync Status" kicker="Live health">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Connection</div>
              <div className="mt-4 text-2xl font-semibold">{tallyStatus.connected ? "Online" : "Waiting"}</div>
              <div className="mt-2 text-sm text-slate-400">Endpoint {tallyConfig.host}:{tallyConfig.port}</div>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last sync</div>
              <div className="mt-4 text-lg font-semibold text-slate-950">{tallyStatus.lastSyncAt ? formatDate(tallyStatus.lastSyncAt) : "Not yet"}</div>
              <div className="mt-2 text-sm text-slate-500">Company {tallyStatus.lastCompanyName || "Not set"}</div>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Entries pushed</div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">{formatNumber(tallyStatus.lastEntryCount)}</div>
              <div className="mt-2 text-sm text-slate-500">{tallyStatus.lastMessage}</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );

  const clientView = (
    <>
      <ModuleHeader
        title="Client Manager"
        description="Switch the active client context, track pending entries by engagement, and keep firm-wide accounting queues visible from one sidebar."
      />
      <SectionCard title="Firm Client Queue" kicker="Portfolio view">
        <div className="overflow-hidden rounded-[24px] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Pending entries</th>
                  <th className="px-4 py-3">Accuracy score</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, index) => (
                  <tr key={client.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-3 font-medium text-slate-900">{client.name}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(client.lastActivity)}</td>
                    <td className="px-4 py-3 text-slate-900">{formatNumber(client.pendingEntries)}</td>
                    <td className="px-4 py-3 text-slate-900">{client.accuracyScore}%</td>
                    <td className="px-4 py-3">
                      <Button variant={client.id === activeClientId ? "secondary" : "ghost"} onClick={() => setActiveClientId(client.id)}>
                        {client.id === activeClientId ? "Active" : "Switch"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
    </>
  );

  const activeView = {
    dashboard: dashboardView,
    bank: bankView,
    invoice: invoiceView,
    recommendations: recommendationView,
    gst: gstView,
    tally: tallyView,
    clients: clientView,
  }[activeModule];

  return (
    <div className="min-h-screen bg-app text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-[290px] shrink-0 rounded-[32px] border border-white/10 bg-slate-950/90 p-5 shadow-soft backdrop-blur lg:flex lg:flex-col">
          <div className="rounded-[28px] bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-blue-300">Tally Automation</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">CA operations platform</div>
            <div className="mt-3 text-sm leading-6 text-slate-400">Dark-navy workflow shell for document extraction, ledger mapping, GST review, and direct TallyPrime sync.</div>
          </div>

          <nav className="mt-6 space-y-2">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeModule === item.id ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-[26px] border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Active client</div>
            <div className="mt-3 text-lg font-semibold text-white">{activeClient?.name || "Loading..."}</div>
            <div className="mt-2 text-sm text-slate-400">
              {activeClient ? `${activeClient.pendingEntries} pending entries • ${activeClient.accuracyScore}% accuracy` : "Loading client metrics"}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-4 shadow-soft backdrop-blur">
            <header className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="lg:hidden">
                    <select
                      value={activeModule}
                      onChange={(event) => setActiveModule(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    >
                      {navigation.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <select
                        value={activeClientId}
                        onChange={(event) => setActiveClientId(event.target.value)}
                        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <Pill className="bg-white/10 text-slate-200">Indian CA-ready workflow</Pill>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" className="rounded-2xl border border-white/10 bg-slate-950 p-3 text-slate-300 transition hover:text-white">
                    <Icon name="bell" className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-semibold text-white">MK</div>
                    <div>
                      <div className="text-sm font-semibold text-white">Mukundan</div>
                      <div className="text-xs text-slate-400">Admin</div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {bootError ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{bootError}</div>
            ) : null}

            {busy ? (
              <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                Working on {busy.replace(/-/g, " ")}...
              </div>
            ) : null}

            <div className="mt-6">{activeView}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function GstUploader({ onSubmit, busy }) {
  const [gstr2bFile, setGstr2bFile] = useState(null);
  const [purchaseRegisterFile, setPurchaseRegisterFile] = useState(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FileInput
          label={gstr2bFile ? gstr2bFile.name : "Upload GSTR-2B"}
          accept=".xlsx,.xls,.csv,application/pdf"
          helper="Excel is best, but PDF is also accepted."
          onChange={setGstr2bFile}
        />
        <FileInput
          label={purchaseRegisterFile ? purchaseRegisterFile.name : "Upload purchase register"}
          accept=".xlsx,.xls,.csv,application/pdf"
          helper="Upload the purchase register export for the same period."
          onChange={setPurchaseRegisterFile}
        />
      </div>
      <Button
        variant="primary"
        onClick={() => {
          if (gstr2bFile && purchaseRegisterFile) {
            onSubmit(gstr2bFile, purchaseRegisterFile);
          }
        }}
        disabled={!gstr2bFile || !purchaseRegisterFile || busy}
      >
        Reconcile GST
      </Button>
    </div>
  );
}

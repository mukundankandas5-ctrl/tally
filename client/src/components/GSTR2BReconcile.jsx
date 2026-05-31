import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { reconcileGstr2bFull, downloadGstr2bReport } from "../utils/api";

// ── Design-system primitives (matching App.jsx) ───────────────────────────────
function cn(...vals) { return vals.filter(Boolean).join(" "); }

function Btn({ variant = "primary", className = "", children, ...props }) {
  const v = {
    primary:      "bg-[#7C3AED] text-white shadow-sm hover:bg-[#6D28D9]",
    ghost:        "bg-white text-[#374151] border border-[#E5E7EB] shadow-sm hover:bg-[#F9FAFB]",
    outlinePurple:"bg-white text-[#7C3AED] border border-[#C4B5FD] shadow-sm hover:bg-[#F5F3FF]",
    danger:       "bg-white text-[#DC2626] border border-[#FCA5A5] shadow-sm hover:bg-[#FEF2F2]",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        v[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, tone = "text-[#111827]" }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="text-[13px] text-[#6B7280]">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

function Dropzone({ title, helper, multiple, onSelect, files }) {
  const inputRef = useRef(null);
  const hasFiles = multiple ? files && files.length > 0 : !!files;

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer",
        hasFiles
          ? "border-[#7C3AED] bg-[#F5F3FF]"
          : "border-[#D1D5DB] bg-[#F9FAFB] hover:border-[#7C3AED] hover:bg-[#F5F3FF]"
      )}
      onClick={() => inputRef.current?.click()}
    >
      <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-[#EDE9FE]">
        <FileSpreadsheet className="h-5 w-5 text-[#7C3AED]" />
      </div>
      <div className="mt-3 text-sm font-semibold text-[#111827]">{title}</div>
      <div className="mt-1 text-xs text-[#6B7280]">{helper}</div>

      {multiple && files && files.length > 0 ? (
        <div className="mt-3 space-y-1 text-left">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs text-[#374151] shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#16A34A]" />
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      ) : !multiple && files ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs text-[#374151] shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#16A34A]" />
          <span className="truncate">{files.name}</span>
        </div>
      ) : (
        <div className="mt-4">
          <span className="rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-semibold text-white">
            Browse {multiple ? "Files" : "File"}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          multiple ? onSelect(Array.from(e.target.files)) : onSelect(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ProgressStages({ stage }) {
  const stages = [
    "Parsing files",
    "Deterministic matching",
    "AI analysis",
    "Generating report",
  ];
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const done    = i < stage;
        const active  = i === stage;
        const pending = i > stage;
        return (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done    && "bg-[#7C3AED] text-white",
                active  && "border-2 border-[#7C3AED] text-[#7C3AED] animate-pulse",
                pending && "border-2 border-[#E5E7EB] text-[#9CA3AF]"
              )}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                done    && "text-[#7C3AED] font-medium",
                active  && "text-[#111827] font-semibold",
                pending && "text-[#9CA3AF]"
              )}
            >
              {s}
            </span>
            {active && (
              <span className="ml-auto text-xs text-[#6B7280] animate-pulse">In progress…</span>
            )}
            {done && (
              <CheckCircle2 className="ml-auto h-4 w-4 text-[#16A34A]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiffBadge({ diff }) {
  const abs = Math.abs(diff || 0);
  if (abs < 500)   return <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]"><CheckCircle2 className="h-3.5 w-3.5" /> Within ₹500</span>;
  if (abs < 5000)  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D97706]"><AlertTriangle className="h-3.5 w-3.5" /> ₹{abs.toLocaleString('en-IN', {minimumFractionDigits:2})} difference</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626]"><AlertTriangle className="h-3.5 w-3.5" /> ₹{abs.toLocaleString('en-IN', {minimumFractionDigits:2})} difference</span>;
}

function fmt(n) {
  return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GSTR2BReconcile() {
  const [phase, setPhase]           = useState("upload");   // upload | processing | results
  const [gstr2bFile, setGstr2bFile] = useState(null);
  const [ledgerFiles, setLedgerFiles] = useState([]);
  const [error, setError]           = useState(null);
  const [progressStage, setProgressStage] = useState(0);
  const [result, setResult]         = useState(null);
  const [activeTab, setActiveTab]   = useState("matched");

  // Auto-advance stage indicator while processing
  const stageTimerRef = useRef(null);
  useEffect(() => {
    if (phase === "processing") {
      stageTimerRef.current = setInterval(() => {
        setProgressStage((s) => Math.min(s + 1, 3));
      }, 8000);
    }
    return () => clearInterval(stageTimerRef.current);
  }, [phase]);

  async function handleStart() {
    if (!gstr2bFile || ledgerFiles.length === 0) return;
    setError(null);
    setProgressStage(0);
    setPhase("processing");

    try {
      const data = await reconcileGstr2bFull(gstr2bFile, ledgerFiles);
      clearInterval(stageTimerRef.current);
      setResult(data);
      setPhase("results");
    } catch (err) {
      clearInterval(stageTimerRef.current);
      setError(err.message || "Reconciliation failed.");
      setPhase("upload");
    }
  }

  function handleReset() {
    setPhase("upload");
    setGstr2bFile(null);
    setLedgerFiles([]);
    setError(null);
    setResult(null);
    setProgressStage(0);
    setActiveTab("matched");
  }

  const summary = result?.summary || {};
  const cgst    = summary.cgst || {};
  const igst    = summary.igst || {};
  const entries = result?.entries || [];

  const tabEntries = {
    matched:      entries.filter((e) => e.status === "matched"),
    unmatched:    entries.filter((e) => e.status === "unmatched"),
    not_in_books: entries.filter((e) => e.status === "not_in_books"),
    books_only:   [], // shown separately in the Others sheet
  };

  // ── Upload state ────────────────────────────────────────────────────────────
  if (phase === "upload") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">GSTR-2B Reconciliation</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Upload your GSTR-2B (from GST portal) and Tally ledger exports. The system runs
            deterministic matching then uses AI for ambiguous entries.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
            <button type="button" className="ml-auto" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <Dropzone
          title="GSTR-2B Export"
          helper="Excel file downloaded from GST portal — must contain the 'B2B' sheet"
          multiple={false}
          files={gstr2bFile}
          onSelect={setGstr2bFile}
        />

        <Dropzone
          title="Tally Ledger Files"
          helper="Select up to 6 Tally ledger Excel files (CGST 1.5%, 2.5%, 9%, IGST 3%, 18%, etc.)"
          multiple={true}
          files={ledgerFiles}
          onSelect={setLedgerFiles}
        />

        {ledgerFiles.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm">
            <span className="text-[#374151]">{ledgerFiles.length} ledger file{ledgerFiles.length > 1 ? "s" : ""} selected</span>
            <button
              type="button"
              className="text-xs text-[#DC2626] hover:underline"
              onClick={() => setLedgerFiles([])}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] p-4">
          <div className="flex items-start gap-2 text-sm text-[#4338CA]">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Large reconciliations (400+ invoices) may take 60–90 seconds — the AI analyses only
              ambiguous entries, so typical runs complete in 20–40 seconds.
            </div>
          </div>
        </div>

        <Btn
          variant="primary"
          className="w-full justify-center py-3 text-base"
          disabled={!gstr2bFile || ledgerFiles.length === 0}
          onClick={handleStart}
        >
          <ShieldCheck className="h-5 w-5" />
          Start Reconciliation
        </Btn>
      </div>
    );
  }

  // ── Processing state ─────────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="mx-auto max-w-md space-y-8 pt-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE9FE]">
            <ShieldCheck className="h-7 w-7 text-[#7C3AED]" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#111827]">Reconciling…</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Processing {gstr2bFile?.name}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <ProgressStages stage={progressStage} />
        </div>

        <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] p-4 text-center text-sm text-[#4338CA]">
          Do not close this window — the report generates automatically when done.
        </div>
      </div>
    );
  }

  // ── Results state ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: "matched",      label: "Matched",         count: tabEntries.matched.length,      tone: "text-[#16A34A]" },
    { id: "unmatched",    label: "Unmatched",        count: tabEntries.unmatched.length,    tone: "text-[#D97706]" },
    { id: "not_in_books", label: "Not in Books",     count: tabEntries.not_in_books.length, tone: "text-[#DC2626]" },
  ];

  const activeRows = tabEntries[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Reconciliation Complete</h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {summary.company && <><span className="font-medium">{summary.company}</span> · </>}
            {summary.gstin && <>{summary.gstin} · </>}
            {summary.period && <>{summary.period} {summary.fy && `(${summary.fy})`}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant="primary"
            onClick={() => downloadGstr2bReport(result.download_url)}
          >
            <Download className="h-4 w-4" />
            Download Excel
          </Btn>
          <Btn variant="ghost" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            New
          </Btn>
        </div>
      </div>

      {/* Summary cards — CGST */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          <span>CGST (Intra-State)</span>
          <DiffBadge diff={cgst.difference} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Matched"         value={cgst.matched ?? 0}      sub={`₹${fmt(cgst.gstr2b_total)} total`} tone="text-[#16A34A]" />
          <StatCard label="Unmatched"       value={cgst.unmatched ?? 0}    tone="text-[#D97706]" />
          <StatCard label="In 2B, Not Books" value={cgst.not_in_books ?? 0} tone="text-[#DC2626]" />
          <StatCard label="In Books, Not 2B" value={cgst.books_only ?? 0}   tone="text-[#7C3AED]" />
        </div>
      </div>

      {/* Summary cards — IGST */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          <span>IGST (Inter-State)</span>
          <DiffBadge diff={igst.difference} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Matched"         value={igst.matched ?? 0}      sub={`₹${fmt(igst.gstr2b_total)} total`} tone="text-[#16A34A]" />
          <StatCard label="Unmatched"       value={igst.unmatched ?? 0}    tone="text-[#D97706]" />
          <StatCard label="In 2B, Not Books" value={igst.not_in_books ?? 0} tone="text-[#DC2626]" />
          <StatCard label="In Books, Not 2B" value={igst.books_only ?? 0}   tone="text-[#7C3AED]" />
        </div>
      </div>

      {/* Tabbed entry table */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-[#E5E7EB]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition",
                activeTab === t.id
                  ? "border-[#7C3AED] text-[#7C3AED]"
                  : "border-transparent text-[#6B7280] hover:text-[#374151]"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  activeTab === t.id ? "bg-[#EDE9FE] text-[#7C3AED]" : "bg-[#F3F4F6] text-[#6B7280]"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {activeRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-[#9CA3AF]" />
            <p className="mt-3 text-sm text-[#6B7280]">No entries in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "matched" && (
              <table className="min-w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.07em] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice No</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Tax ₹</th>
                    <th className="px-4 py-3 font-medium">Books Party</th>
                    <th className="px-4 py-3 font-medium">Books Tax ₹</th>
                    <th className="px-4 py-3 font-medium">Diff ₹</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F0FDF4]">
                      <td className="px-4 py-2.5 font-medium text-[#111827]">{r.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[#374151]">{r.supplier_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6B7280]">{r.gstin}</td>
                      <td className="px-4 py-2.5">{fmt(r.tax_amount)}</td>
                      <td className="px-4 py-2.5 text-[#374151]">{r.books_party || "—"}</td>
                      <td className="px-4 py-2.5">{r.books_tax != null ? fmt(r.books_tax) : "—"}</td>
                      <td className={cn("px-4 py-2.5 font-semibold", (r.tax_diff || 0) > 1 ? "text-[#DC2626]" : "text-[#16A34A]")}>
                        {fmt(r.tax_diff)}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B7280]">{r.tax_type}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">
                          {r.match_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "unmatched" && (
              <table className="min-w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.07em] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice No</th>
                    <th className="px-4 py-3 font-medium">Vendor (2B)</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">GSTR-2B Tax ₹</th>
                    <th className="px-4 py-3 font-medium">Books Tax ₹</th>
                    <th className="px-4 py-3 font-medium">Diff ₹</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#FFFBEB]">
                      <td className="px-4 py-2.5 font-medium text-[#111827]">{r.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[#374151]">{r.supplier_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6B7280]">{r.gstin}</td>
                      <td className="px-4 py-2.5">{fmt(r.tax_amount)}</td>
                      <td className="px-4 py-2.5">{r.books_tax != null ? fmt(r.books_tax) : "—"}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#D97706]">
                        {fmt(r.tax_diff)}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B7280]">{r.tax_type}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6B7280]">{r.discrepancy_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "not_in_books" && (
              <table className="min-w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.07em] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice No</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Tax ₹</th>
                    <th className="px-4 py-3 font-medium">ITC Available</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#EFF6FF]">
                      <td className="px-4 py-2.5 font-medium text-[#111827]">{r.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[#374151]">{r.supplier_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6B7280]">{r.gstin}</td>
                      <td className="px-4 py-2.5 text-[#6B7280]">{r.invoice_date}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#DC2626]">{fmt(r.tax_amount)}</td>
                      <td className="px-4 py-2.5">
                        {(r.itc_availability || '').toUpperCase() === 'NO' ? (
                          <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-medium text-[#991B1B]">
                            Blocked
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">
                            {r.itc_availability || "Yes"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B7280]">{r.tax_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Download reminder */}
      <div className="flex items-center justify-between rounded-xl border border-[#C4B5FD] bg-[#F5F3FF] px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-[#7C3AED]">Full 5-sheet Excel report ready</div>
          <div className="mt-0.5 text-xs text-[#6B7280]">Includes Summary, Matched, Unmatched, Not in Books, and Others sheets with CA-ready formatting</div>
        </div>
        <Btn variant="primary" onClick={() => downloadGstr2bReport(result.download_url)}>
          <Download className="h-4 w-4" />
          Download
        </Btn>
      </div>
    </div>
  );
}

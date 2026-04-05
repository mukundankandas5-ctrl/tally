import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Home,
  Landmark,
  LogOut,
  Menu,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import { List } from "react-window";
import * as XLSX from "xlsx";
import { createDemoBankStatement, createDemoInvoice } from "./constants/sampleData";
import {
  analyzeRecommendations,
  createPairingCode,
  downloadRecommendationXml,
  fetchClients,
  fetchLedgers,
  fetchTallyStatus,
  pushBankStatementToTally,
  pushInvoiceToTally,
  pushXmlToTally,
  reconcileGst,
  reviseBankStatement,
  reviseInvoice,
  testTallyConnection,
  uploadBankStatement,
  uploadInvoice,
} from "./utils/api";
import { formatCurrency, formatDate, formatNumber } from "./utils/formatters";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const ROW_HEIGHT = 52;

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "bank", label: "Bank Statement", icon: Landmark },
  { id: "invoice", label: "Invoice Processor", icon: Receipt },
  { id: "recommendations", label: "Speedy Recommendations", icon: Sparkles },
  { id: "gst", label: "GST Reconciliation", icon: ShieldCheck },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

const statusBadgeStyles = {
  resolved: "bg-[#DCFCE7] text-[#16A34A]",
  pending: "bg-[#FEF3C7] text-[#D97706]",
  failed: "bg-[#FEE2E2] text-[#DC2626]",
};

const voucherOptions = ["Payment", "Receipt", "Contra", "Purchase", "Journal"];

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function buildStatusFromConfidence(confidence, unresolved) {
  if (unresolved || confidence === "low") return "pending";
  return "resolved";
}

function normalizeBankRows(statement) {
  return (statement.transactions || []).map((row) => ({
    id: row.id,
    sourceId: row.id,
    status: buildStatusFromConfidence(row.confidence, row.needsReview),
    confidence: row.confidence || "medium",
    date: row.date,
    particulars: row.narration,
    amount: Number(row.debit || row.credit || 0),
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    ledger: row.ledgerHead || "Suspense",
    voucherType: row.voucherType || "Payment",
    original: row,
  }));
}

function normalizeRecommendationRows(payload) {
  return (payload.mappings || []).map((row) => ({
    id: row.id,
    sourceId: row.id,
    status: row.accepted ? "resolved" : row.suggestion?.confidence === "low" ? "pending" : "pending",
    confidence: row.suggestion?.confidence || "medium",
    date: row.date,
    particulars: row.description,
    amount: Number(row.debit || row.credit || 0),
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    ledger: row.suggestion?.ledgerHead || row.currentLedger || "Suspense",
    voucherType: row.suggestion?.voucherType || "Payment",
    original: row,
  }));
}

function normalizeInvoiceRows(invoice) {
  return (invoice.lineItems || []).map((item) => ({
    id: item.id,
    sourceId: item.id,
    status: invoice.confidence === "low" ? "pending" : "resolved",
    confidence: invoice.confidence || "medium",
    date: invoice.invoiceDate,
    particulars: item.description,
    amount: Number(item.amount || 0),
    debit: Number(item.amount || 0),
    credit: 0,
    ledger: invoice.tallyConfig?.purchaseLedgerName || "Purchase A/c",
    voucherType: "Purchase",
    original: item,
  }));
}

function countTotals(rows) {
  return rows.reduce(
    (acc, row) => ({
      debit: acc.debit + Number(row.debit || 0),
      credit: acc.credit + Number(row.credit || 0),
    }),
    { debit: 0, credit: 0 }
  );
}

function getVisibleRows(rows, filters) {
  return rows.filter((row) => {
    const query = filters.search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      row.particulars.toLowerCase().includes(query) ||
      row.ledger.toLowerCase().includes(query) ||
      row.voucherType.toLowerCase().includes(query);
    const matchesStatus = filters.status === "all" || row.status === filters.status;
    const matchesVoucher = filters.voucherType === "all" || row.voucherType === filters.voucherType;
    return matchesQuery && matchesStatus && matchesVoucher;
  });
}

function AppIconButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F9FAFB]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Button({ variant = "primary", className = "", children, ...props }) {
  const variants = {
    primary: "bg-[#7C3AED] text-white hover:bg-[#6D28D9] border border-[#7C3AED]",
    ghost: "bg-white text-[#374151] border border-[#D1D5DB] hover:bg-[#F9FAFB]",
    outlinePurple: "bg-white text-[#7C3AED] border border-[#C4B5FD] hover:bg-[#F5F3FF]",
    danger: "bg-white text-[#DC2626] border border-[#FCA5A5] hover:bg-[#FEF2F2]",
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({ status, confidence }) {
  const dotClass =
    confidence === "high" ? "bg-[#16A34A]" : confidence === "low" ? "bg-[#DC2626]" : "bg-[#D97706]";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", statusBadgeStyles[status])}>
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      {status === "resolved" ? "Resolved" : status === "failed" ? "Failed" : "Pending"}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-xl border bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.12)]",
            toast.tone === "success" && "border-[#BBF7D0] border-l-4 border-l-[#16A34A]",
            toast.tone === "error" && "border-[#FECACA] border-l-4 border-l-[#DC2626]",
            toast.tone === "info" && "border-[#E5E7EB]"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-[#111827]">{toast.message}</div>
            <button type="button" className="text-[#9CA3AF]" onClick={() => onDismiss(toast.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FileDropCard({ title, helper, accept, onSelect }) {
  return (
    <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 text-center">
      <FileSpreadsheet className="h-7 w-7 text-[#7C3AED]" />
      <div className="mt-3 text-sm font-semibold text-[#111827]">{title}</div>
      <div className="mt-2 max-w-sm text-sm text-[#6B7280]">{helper}</div>
      <div className="mt-4 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-medium text-[#374151]">Choose file</div>
      <input
        className="hidden"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function TallyStatusBadge({ onConnectClick, onStatus }) {
  const [status, setStatus] = useState({
    connectorConnected: false,
    tallyConnected: false,
    tallyCompany: "",
  });

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const payload = await fetchTallyStatus();
        if (!active) return;
        setStatus(payload);
        onStatus?.(payload);
      } catch (error) {
        if (!active) return;
        const fallback = { connectorConnected: false, tallyConnected: false, tallyCompany: "" };
        setStatus(fallback);
        onStatus?.(fallback);
      }
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const dot = status.tallyConnected ? "bg-[#16A34A]" : status.connectorConnected ? "bg-[#D97706]" : "bg-[#DC2626]";
  const label = status.tallyConnected
    ? `TallyPrime: Connected — ${status.tallyCompany || "Company"}`
    : status.connectorConnected
      ? "Connector active — open TallyPrime"
      : "Tally Connector: Disconnected";

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{label}</span>
      {!status.connectorConnected ? (
        <button type="button" onClick={onConnectClick} className="font-medium text-[#7C3AED]">
          Connect
        </button>
      ) : null}
    </div>
  );
}

function PairingModal({ open, code, onClose, connected }) {
  useEffect(() => {
    if (connected && open) {
      onClose();
    }
  }, [connected, open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#111827]/40 p-4">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[#111827]">Connect Tally</div>
        <p className="mt-3 text-sm text-[#6B7280]">
          Open the Tally AI Connector app on your Windows PC and enter this code.
        </p>
        <div className="mt-6 rounded-xl border border-[#E9D5FF] bg-[#F5F3FF] px-6 py-8 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#7C3AED]">Pairing code</div>
          <div className="mt-2 text-5xl font-semibold tracking-[0.28em] text-[#111827]">{code || "------"}</div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, body, confirmText, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#111827]/40 p-4">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[#111827]">{title}</div>
        <div className="mt-3 text-sm leading-6 text-[#6B7280]">{body}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SearchField({ value, onChange }) {
  return (
    <div className="relative min-w-[240px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search transactions..."
        className="h-10 w-full rounded-lg border border-[#D1D5DB] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none ring-0 placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
      />
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#374151]">
      <span className="text-[#6B7280]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
    </label>
  );
}

function EditableCellSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-[#C4B5FD] focus:ring-2 focus:ring-[#F5F3FF]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function EditableAmountInput({ value, onChange, tone }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn(
        "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-sm outline-none hover:border-[#D1D5DB] focus:border-[#C4B5FD] focus:ring-2 focus:ring-[#F5F3FF]",
        tone === "debit" ? "text-[#DC2626]" : "text-[#16A34A]"
      )}
    />
  );
}

function TableRow({
  row,
  isSelected,
  flash,
  onToggle,
  onFieldChange,
  ledgerOptions,
}) {
  return (
    <div
      className={cn(
        "grid h-[52px] items-center border-b border-[#F3F4F6] bg-white text-sm transition hover:bg-[#F9FAFB]",
        isSelected && "bg-[#F5F3FF]",
        flash && "row-flash"
      )}
      style={{ gridTemplateColumns: "40px 100px 100px minmax(280px,1fr) 120px 120px 120px 200px 150px" }}
    >
      <div className="flex items-center justify-center">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.id)} className="h-4 w-4 accent-[#7C3AED]" />
      </div>
      <div className="px-3">
        <Badge status={row.status} confidence={row.confidence} />
      </div>
      <div className="px-3 text-[#4B5563]">{formatDate(row.date)}</div>
      <div className="truncate px-3 text-[#111827]">{row.particulars}</div>
      <div className="px-3 text-right font-medium text-[#111827]">{formatCurrency(row.amount)}</div>
      <div className="px-3">
        <EditableAmountInput value={row.debit} tone="debit" onChange={(value) => onFieldChange(row.id, "debit", value)} />
      </div>
      <div className="px-3">
        <EditableAmountInput value={row.credit} tone="credit" onChange={(value) => onFieldChange(row.id, "credit", value)} />
      </div>
      <div className="px-3">
        <EditableCellSelect value={row.ledger} onChange={(value) => onFieldChange(row.id, "ledger", value)} options={ledgerOptions} />
      </div>
      <div className="px-3">
        <EditableCellSelect value={row.voucherType} onChange={(value) => onFieldChange(row.id, "voucherType", value)} options={voucherOptions} />
      </div>
    </div>
  );
}

function VirtualTableRow({ index, style, rowProps }) {
  const row = rowProps.visibleRows[index];
  return (
    <div style={style}>
      <TableRow
        row={row}
        isSelected={rowProps.selectedRowIds.includes(row.id)}
        flash={rowProps.flashRowIds.includes(row.id)}
        onToggle={rowProps.onToggleRow}
        onFieldChange={rowProps.onFieldChange}
        ledgerOptions={rowProps.ledgerOptions}
      />
    </div>
  );
}

function EntryTable({
  title,
  subtitle,
  rows,
  ledgerOptions,
  filters,
  onFiltersChange,
  selectedRowIds,
  onToggleRow,
  onToggleAll,
  onFieldChange,
  onApproveSelected,
  onMapSuspense,
  onExport,
  onSendToTally,
  recommendationCards,
  onApproveRecommendation,
  aiHint,
  onAiHintChange,
  onApplyAiHint,
  flashRowIds,
}) {
  const visibleRows = useMemo(() => getVisibleRows(rows, filters), [rows, filters]);
  const visibleSelectedCount = visibleRows.filter((row) => selectedRowIds.includes(row.id)).length;
  const totals = countTotals(visibleRows);
  const unresolvedCount = visibleRows.filter((row) => row.status !== "resolved").length;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRowIds.includes(row.id));
  const [bulkLedger, setBulkLedger] = useState(ledgerOptions[0] || "Suspense");
  const [showSuspensePopover, setShowSuspensePopover] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const tableHeight = Math.min(visibleRows.length, 8) * ROW_HEIGHT + 44;

  const renderHeader = (
    <div className="grid h-11 items-center bg-[#F9FAFB] text-xs uppercase tracking-[0.08em] text-[#6B7280]" style={{ gridTemplateColumns: "40px 100px 100px minmax(280px,1fr) 120px 120px 120px 200px 150px" }}>
      <div className="flex items-center justify-center">
        <input type="checkbox" checked={allVisibleSelected} onChange={onToggleAll} className="h-4 w-4 accent-[#7C3AED]" />
      </div>
      <div className="px-3 font-medium">Status</div>
      <div className="px-3 font-medium">Date</div>
      <div className="px-3 font-medium">Particulars</div>
      <div className="px-3 text-right font-medium">Amount</div>
      <div className="px-3 text-right font-medium">Debit</div>
      <div className="px-3 text-right font-medium">Credit</div>
      <div className="px-3 font-medium">Ledger</div>
      <div className="px-3 font-medium">Voucher Type</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="border-b border-[#E5E7EB] px-5 py-4">
        <div className="text-lg font-semibold text-[#111827]">{title}</div>
        <div className="mt-1 text-sm text-[#6B7280]">{subtitle}</div>
      </div>

      <div className="px-5 py-4">
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {recommendationCards.length ? (
            recommendationCards.map((card) => (
              <div key={card.id} className="fade-in min-w-[280px] rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <div className="border-l-[3px] border-[#7C3AED] pl-3">
                  <div className="line-clamp-2 text-sm font-semibold text-[#111827]">{card.particulars}</div>
                  <div className="mt-2 text-sm text-[#7C3AED]">{card.ledger}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => onApproveRecommendation(card.id)}>
                    Approve
                  </Button>
                  <Button variant="ghost" className="px-3 py-1.5 text-xs">
                    Skip
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-6 text-sm text-[#6B7280]">
              No recommendation cards for the current selection.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <div className="text-sm font-medium text-[#111827]">Adjustment instructions</div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <textarea
              value={aiHint}
              onChange={(event) => onAiHintChange(event.target.value)}
              placeholder="Example: Treat UPI transactions containing family names as remittance instead of salary or expense."
              className="min-h-[72px] flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF]"
            />
            <Button variant="outlinePurple" className="h-fit" onClick={onApplyAiHint}>
              <Sparkles className="h-4 w-4" />
              Apply AI Hint
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SearchField value={filters.search} onChange={(value) => onFiltersChange({ ...filters, search: value })} />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => onFiltersChange({ ...filters, status: value })}
              options={[
                { value: "all", label: "All" },
                { value: "resolved", label: "Resolved" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
              ]}
            />
            <FilterSelect
              label="Voucher"
              value={filters.voucherType}
              onChange={(value) => onFiltersChange({ ...filters, voucherType: value })}
              options={[
                { value: "all", label: "All" },
                ...voucherOptions.map((option) => ({ value: option, label: option })),
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onExport}>
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
            <Button variant="primary" onClick={() => setShowConfirm(true)}>
              <Send className="h-4 w-4" />
              Send to Tally
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-[#E5E7EB]" />

        {visibleSelectedCount > 0 ? (
          <div className="sticky top-[68px] z-10 mt-4 flex items-center justify-between rounded-lg bg-[#1E1B4B] px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(30,27,75,0.22)]">
            <div>{visibleSelectedCount} rows selected</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-white">
                <span>Apply ledger to all selected</span>
                <select
                  value={bulkLedger}
                  onChange={(event) => setBulkLedger(event.target.value)}
                  className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-white outline-none"
                >
                  {ledgerOptions.map((option) => (
                    <option key={option} value={option} className="text-[#111827]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" onClick={() => onApproveSelected(bulkLedger)}>
                Update
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB]">
          <div className="overflow-x-auto">
            <div className="min-w-[1070px]">
              {renderHeader}
              {visibleRows.length > 100 ? (
                <List
                  rowComponent={VirtualTableRow}
                  rowCount={visibleRows.length}
                  rowHeight={ROW_HEIGHT}
                  rowProps={{ visibleRows, selectedRowIds, onToggleRow, onFieldChange, ledgerOptions, flashRowIds }}
                  style={{ height: Math.min(visibleRows.length, 8) * ROW_HEIGHT }}
                >
                </List>
              ) : (
                <div>
                  {visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      row={row}
                      isSelected={selectedRowIds.includes(row.id)}
                      flash={flashRowIds.includes(row.id)}
                      onToggle={onToggleRow}
                      onFieldChange={onFieldChange}
                      ledgerOptions={ledgerOptions}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 mt-0 flex flex-col gap-3 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#4B5563]">
            <span>Total rows: {visibleRows.length}</span>
            <span>Selected: {visibleSelectedCount}</span>
            <span className="text-[#DC2626]">Debit: {formatCurrency(totals.debit)}</span>
            <span className="text-[#16A34A]">Credit: {formatCurrency(totals.credit)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={visibleSelectedCount === 0} onClick={() => onApproveSelected("resolved")}>
              Approve Selected
            </Button>
            <div className="relative">
              <Button variant="ghost" onClick={() => setShowSuspensePopover((current) => !current)}>
                Map to Suspense
              </Button>
              {showSuspensePopover ? (
                <div className="absolute bottom-full right-0 mb-2 w-[280px] rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                  <div className="text-sm text-[#111827]">Map {unresolvedCount} unresolved entries to Suspense ledger?</div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button type="button" className="text-sm text-[#6B7280]" onClick={() => setShowSuspensePopover(false)}>
                      Cancel
                    </button>
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        onMapSuspense();
                        setShowSuspensePopover(false);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Push to Tally"
        body={`You are about to push ${visibleSelectedCount || visibleRows.filter((row) => row.status === "resolved").length} entries to TallyPrime. Unresolved entries will be skipped.`}
        confirmText="Confirm & Push"
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onSendToTally(visibleRows);
        }}
      />
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bootError, setBootError] = useState("");
  const [busy, setBusy] = useState("");
  const [ledgerHeads, setLedgerHeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [tallyStatus, setTallyStatus] = useState({ connectorConnected: false, tallyConnected: false, tallyCompany: "" });
  const [pairingCode, setPairingCode] = useState("");
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activity, setActivity] = useState([
    { id: "a1", text: "128 bank rows mapped from SBI statement", time: "Today, 11:42 AM", status: "Resolved" },
    { id: "a2", text: "Purchase voucher sent to TallyPrime", time: "Today, 10:16 AM", status: "Resolved" },
    { id: "a3", text: "3 rows need review before push", time: "Today, 09:51 AM", status: "Pending" },
  ]);
  const [syncHistory, setSyncHistory] = useState([
    { id: "s1", time: "11:42 AM", type: "Bank", entries: 25, status: "Resolved", company: "Aurora Traders LLP" },
    { id: "s2", time: "10:16 AM", type: "Invoice", entries: 1, status: "Resolved", company: "Aurora Traders LLP" },
    { id: "s3", time: "Yesterday", type: "Recommendations", entries: 18, status: "Failed", company: "Bluewave Retail Pvt Ltd" },
  ]);

  const [bankStatement, setBankStatement] = useState(createDemoBankStatement({ bankLedgerName: "Bank Account" }));
  const [bankRows, setBankRows] = useState(normalizeBankRows(createDemoBankStatement({ bankLedgerName: "Bank Account" })));
  const [bankFilters, setBankFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [bankSelected, setBankSelected] = useState([]);
  const [bankHint, setBankHint] = useState("");

  const [invoice, setInvoice] = useState(createDemoInvoice({ purchaseLedgerName: "Purchase A/c" }));
  const [invoiceRows, setInvoiceRows] = useState(normalizeInvoiceRows(createDemoInvoice({ purchaseLedgerName: "Purchase A/c" })));
  const [invoiceFilters, setInvoiceFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [invoiceSelected, setInvoiceSelected] = useState([]);
  const [invoiceHint, setInvoiceHint] = useState("");

  const [recommendations, setRecommendations] = useState({
    confidence: "medium",
    summary: { totalRows: 0, acceptedCount: 0, needsReviewCount: 0 },
    mappings: [],
    learningSummary: { learnedRuleCount: 0, recentInstructions: [] },
    tallyConfig: { companyName: "", bankLedgerName: "Bank Account" },
  });
  const [recommendationRows, setRecommendationRows] = useState([]);
  const [recommendationFilters, setRecommendationFilters] = useState({ search: "", status: "all", voucherType: "all" });
  const [recommendationSelected, setRecommendationSelected] = useState([]);
  const [recommendationHint, setRecommendationHint] = useState("");

  const [gstReport, setGstReport] = useState({ summary: { matched: 0, partial: 0, unmatched: 0 }, rows: [] });
  const [settingsForm, setSettingsForm] = useState({
    host: "localhost",
    port: "9000",
    companyName: "",
    anthropicApiKey: "",
    showApiKey: false,
    deviceId: "",
  });
  const [testConnectionResult, setTestConnectionResult] = useState("");
  const [flashRowIds, setFlashRowIds] = useState([]);

  const activeClient = clients[0];
  const pageTitle = navigation.find((item) => item.id === activePage)?.label || "Dashboard";
  const ledgerOptions = useMemo(
    () => Array.from(new Set([...ledgerHeads.map((item) => item.name), "Suspense", "Suspense A/c", "Remittance"])),
    [ledgerHeads]
  );

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetchLedgers(), fetchClients(), fetchTallyStatus()])
      .then(([ledgerPayload, clientPayload, tallyPayload]) => {
        if (!active) return;
        setLedgerHeads(ledgerPayload.ledgerHeads || []);
        setClients(clientPayload.clients || []);
        setTallyStatus(tallyPayload);
        setSettingsForm((current) => ({
          ...current,
          companyName: tallyPayload.tallyCompany || "",
          deviceId: tallyPayload.deviceId || "",
        }));
      })
      .catch((error) => {
        if (!active) return;
        setBootError(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  function addToast(message, tone = "info", duration = 2400) {
    const id = createId();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, duration);
  }

  function addActivity(text, status = "Resolved") {
    const item = { id: createId(), text, time: "Just now", status };
    setActivity((current) => [item, ...current].slice(0, 8));
  }

  function addSyncHistory(type, entries, status) {
    setSyncHistory((current) => [
      {
        id: createId(),
        time: "Just now",
        type,
        entries,
        status,
        company: tallyStatus.tallyCompany || activeClient?.name || "Primary Company",
      },
      ...current,
    ]);
  }

  function withFlash(rowIds) {
    setFlashRowIds((current) => Array.from(new Set([...current, ...rowIds])));
    window.setTimeout(() => {
      setFlashRowIds((current) => current.filter((id) => !rowIds.includes(id)));
    }, 320);
  }

  async function withBusy(key, task) {
    setBusy(key);
    setBootError("");
    try {
      await task();
    } catch (error) {
      setBootError(error.message);
      addToast(error.message, "error", 4000);
    } finally {
      setBusy("");
    }
  }

  function toggleRow(selected, setSelected, id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll(visibleRows, selected, setSelected) {
    const visibleIds = visibleRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => selected.includes(id));
    setSelected((current) => (allSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))));
  }

  function updateRowCollection(setter, id, field, value) {
    setter((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
              amount: field === "debit" || field === "credit" ? Number(value || row.amount) : row.amount,
              status: field === "status" ? value : "resolved",
            }
          : row
      )
    );
    withFlash([id]);
  }

  async function handleBankUpload(file) {
    await withBusy("bank-upload", async () => {
      const payload = await uploadBankStatement(file);
      setBankStatement(payload);
      setBankRows(normalizeBankRows(payload));
      setActivePage("bank");
      addActivity(`Loaded bank statement ${file.name}`, "Resolved");
    });
  }

  async function handleInvoiceUpload(file) {
    await withBusy("invoice-upload", async () => {
      const payload = await uploadInvoice(file);
      setInvoice(payload);
      setInvoiceRows(normalizeInvoiceRows(payload));
      setActivePage("invoice");
      addActivity(`Processed invoice ${payload.invoiceNumber || file.name}`, "Resolved");
    });
  }

  async function handleRecommendationUpload(file) {
    await withBusy("recommendation-upload", async () => {
      const payload = await analyzeRecommendations(file);
      setRecommendations(payload);
      setRecommendationRows(normalizeRecommendationRows(payload));
      setActivePage("recommendations");
      addActivity(`Prepared AI suggestions from ${file.name}`, "Resolved");
    });
  }

  async function handleBankHintApply() {
    if (!bankHint.trim()) return;
    await withBusy("bank-revise", async () => {
      const statementPayload = {
        ...bankStatement,
        transactions: bankRows.map((row) => ({
          ...row.original,
          debit: row.debit,
          credit: row.credit,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          needsReview: row.status !== "resolved",
        })),
      };
      const revised = await reviseBankStatement(statementPayload, bankHint);
      setBankStatement(revised);
      setBankRows(normalizeBankRows(revised));
      addToast("Updated classifications using your instruction.", "success");
    });
  }

  async function handleInvoiceHintApply() {
    if (!invoiceHint.trim()) return;
    await withBusy("invoice-revise", async () => {
      const revised = await reviseInvoice(invoice, invoiceHint);
      setInvoice(revised);
      setInvoiceRows(normalizeInvoiceRows(revised));
      addToast("Updated invoice extraction using your instruction.", "success");
    });
  }

  function handleRecommendationHintApply() {
    if (!recommendationHint.trim()) return;
    const lowered = recommendationHint.toLowerCase();
    setRecommendationRows((current) =>
      current.map((row) => {
        if (lowered.includes("remittance") && row.particulars.toLowerCase().includes("upi")) {
          return { ...row, ledger: "Remittance", status: "resolved" };
        }
        return row;
      })
    );
    withFlash(recommendationRows.filter((row) => row.particulars.toLowerCase().includes("upi")).map((row) => row.id));
    addToast("Applied table-side mapping hint to visible recommendations.", "success");
  }

  function approveSelected(setter, selected, ledgerOrResolved = "resolved") {
    setter((current) =>
      current.map((row) =>
        selected.includes(row.id)
          ? {
              ...row,
              ledger: ledgerOrResolved !== "resolved" ? ledgerOrResolved : row.ledger,
              status: "resolved",
            }
          : row
      )
    );
    withFlash(selected);
  }

  function mapSuspense(setter) {
    setter((current) =>
      current.map((row) => (row.status !== "resolved" ? { ...row, ledger: "Suspense", status: "resolved" } : row))
    );
    addToast("Mapped unresolved entries to Suspense.", "success");
  }

  function approveRecommendationCard(id) {
    setRecommendationRows((current) => current.map((row) => (row.id === id ? { ...row, status: "resolved" } : row)));
    withFlash([id]);
  }

  function exportRowsToExcel(rows, filename, filters) {
    const visibleRows = getVisibleRows(rows, filters).map((row) => ({
      Status: row.status,
      Date: row.date,
      Particulars: row.particulars,
      Amount: row.amount,
      Debit: row.debit,
      Credit: row.credit,
      Ledger: row.ledger,
      VoucherType: row.voucherType,
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(visibleRows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Entries");
    XLSX.writeFile(workbook, filename);
    addToast("Exporting to Excel...", "info", 2000);
  }

  async function handleBankPush(visibleRows) {
    const rowsToPush = (bankSelected.length ? visibleRows.filter((row) => bankSelected.includes(row.id)) : visibleRows).filter(
      (row) => row.status === "resolved"
    );
    if (!rowsToPush.length) {
      addToast("No resolved entries selected for Tally push.", "error");
      return;
    }

    addToast(`Pushing ${rowsToPush.length} entries to Tally...`, "info", 3000);
    await withBusy("bank-push", async () => {
      const payload = {
        ...bankStatement,
        transactions: rowsToPush.map((row) => ({
          ...row.original,
          debit: row.debit,
          credit: row.credit,
          ledgerHead: row.ledger,
          voucherType: row.voucherType,
          needsReview: false,
        })),
      };
      const result = await pushBankStatementToTally(payload, settingsForm);
      let processed = 0;
      rowsToPush.forEach((row, index) => {
        window.setTimeout(() => {
          setBankRows((current) =>
            current.map((item) => (item.id === row.id ? { ...item, status: result.success === false ? "failed" : "resolved" } : item))
          );
        }, index * 120);
        processed += 1;
      });
      addToast(`${processed} entries pushed successfully. ${result.success === false ? processed : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Bank", processed, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handleInvoicePush() {
    addToast("Pushing 1 entry to Tally...", "info", 3000);
    await withBusy("invoice-push", async () => {
      const result = await pushInvoiceToTally(invoice, settingsForm);
      setInvoiceRows((current) => current.map((row) => ({ ...row, status: result.success === false ? "failed" : "resolved" })));
      addToast(`1 entry pushed successfully. ${result.success === false ? 1 : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Invoice", 1, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handleRecommendationPush(visibleRows) {
    const rowsToPush = (recommendationSelected.length ? visibleRows.filter((row) => recommendationSelected.includes(row.id)) : visibleRows).filter(
      (row) => row.status === "resolved"
    );
    if (!rowsToPush.length) {
      addToast("No resolved recommendations selected for Tally push.", "error");
      return;
    }

    addToast(`Pushing ${rowsToPush.length} entries to Tally...`, "info", 3000);
    await withBusy("recommendation-push", async () => {
      const filteredPayload = {
        ...recommendations,
        mappings: recommendations.mappings.filter((item) => rowsToPush.some((row) => row.id === item.id)).map((item) => ({
          ...item,
          accepted: true,
          suggestion: {
            ...item.suggestion,
            ledgerHead: rowsToPush.find((row) => row.id === item.id)?.ledger || item.suggestion?.ledgerHead,
            voucherType: rowsToPush.find((row) => row.id === item.id)?.voucherType || item.suggestion?.voucherType,
          },
        })),
      };

      const xmlBlob = await downloadRecommendationXml(filteredPayload);
      const xml = await xmlBlob.text();
      const result = await pushXmlToTally(xml);
      rowsToPush.forEach((row, index) => {
        window.setTimeout(() => {
          setRecommendationRows((current) =>
            current.map((item) => (item.id === row.id ? { ...item, status: result.success === false ? "failed" : "resolved" } : item))
          );
        }, index * 120);
      });
      addToast(`${rowsToPush.length} entries pushed successfully. ${result.success === false ? rowsToPush.length : 0} failed.`, result.success === false ? "error" : "success", 4000);
      addSyncHistory("Recommendations", rowsToPush.length, result.success === false ? "Failed" : "Resolved");
    });
  }

  async function handlePairing() {
    await withBusy("pairing", async () => {
      const payload = await createPairingCode();
      setPairingCode(payload.pairingCode || "");
      setPairingModalOpen(true);
    });
  }

  async function handleTestConnection() {
    await withBusy("test-connection", async () => {
      const payload = await testTallyConnection(settingsForm);
      setTestConnectionResult(payload.tallyConnected || payload.connectorConnected ? "Connected" : "Failed");
      addToast(payload.tallyConnected || payload.connectorConnected ? "Connected" : "Failed", payload.tallyConnected || payload.connectorConnected ? "success" : "error");
    });
  }

  async function handleReconcile(gstr2bFile, purchaseRegisterFile) {
    await withBusy("gst-reconcile", async () => {
      const payload = await reconcileGst(gstr2bFile, purchaseRegisterFile);
      setGstReport(payload);
      addToast("GST reconciliation completed.", "success");
    });
  }

  const bankRecommendationCards = bankRows.filter((row) => row.status === "pending").slice(0, 8);
  const recommendationCards = recommendationRows.filter((row) => row.status === "pending").slice(0, 8);
  const invoiceCards = invoiceRows.filter((row) => row.status === "pending").slice(0, 8);

  const dashboardStats = [
    { label: "Entries Pushed Today", value: formatNumber(syncHistory.reduce((sum, item) => sum + item.entries, 0)), change: "+12 today", icon: Send },
    { label: "Invoices Processed", value: formatNumber(invoiceRows.length || 1), change: "+3 this week", icon: Receipt },
    { label: "Bank Rows Mapped", value: formatNumber(bankRows.length), change: "+84 today", icon: Landmark },
    { label: "Hours Saved", value: "17.5", change: "+2.4 today", icon: Clock3 },
  ];

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[#1E1B4B] text-white transition-all duration-200 md:translate-x-0",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Building2 className="h-5 w-5" />
              </div>
              {!sidebarCollapsed ? <div className="text-sm font-semibold">Tally AI</div> : null}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden rounded-md p-1 text-white/80 hover:bg-white/10 md:inline-flex"
            >
              {sidebarCollapsed ? <ArrowRightToLine className="h-4 w-4" /> : <ArrowLeftToLine className="h-4 w-4" />}
            </button>
          </div>
          <div className="mx-4 border-b border-white/10" />
          <nav className="mt-3 flex-1 px-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={cn(
                    "mb-1 flex w-full items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "border-l-[#7C3AED] bg-white/10"
                      : "border-l-transparent hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3">
              <UserCircle2 className="h-8 w-8 text-white/90" />
              {!sidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{activeClient?.name || "Mukundan"}</div>
                    <div className="text-xs text-white/70">Administrator</div>
                  </div>
                  <LogOut className="h-4 w-4 text-white/70" />
                </>
              ) : null}
            </div>
          </div>
        </aside>

        {mobileSidebarOpen ? <button type="button" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileSidebarOpen(false)} /> : null}

        <div className="flex-1 md:ml-[220px]" style={{ marginLeft: sidebarCollapsed && window.innerWidth >= 768 ? SIDEBAR_COLLAPSED_WIDTH : undefined }}>
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 md:px-6">
            <div className="flex items-center gap-3">
              <AppIconButton className="h-9 w-9 md:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </AppIconButton>
              <div className="text-[18px] font-semibold text-[#111827]">{pageTitle}</div>
            </div>
            <div className="flex items-center gap-3">
              <TallyStatusBadge onConnectClick={handlePairing} onStatus={(payload) => setTallyStatus(payload)} />
              <AppIconButton className="h-9 w-9">
                <Bell className="h-4 w-4" />
              </AppIconButton>
              <UserCircle2 className="h-8 w-8 text-[#6B7280]" />
            </div>
          </header>

          <main className="px-4 py-5 md:px-6">
            {bootError ? <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{bootError}</div> : null}
            {busy ? <div className="mb-4 rounded-lg border border-[#E9D5FF] bg-[#F5F3FF] px-4 py-3 text-sm text-[#6D28D9]">Working on {busy.replace(/-/g, " ")}...</div> : null}

            {activePage === "dashboard" ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {dashboardStats.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-[13px] text-[#6B7280]">{card.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-[#111827]">{card.value}</div>
                        <div className="mt-2 text-sm text-[#16A34A]">{card.change}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <div className="border-b border-[#E5E7EB] px-5 py-4 text-lg font-semibold">Recent Activity</div>
                    <div className="divide-y divide-[#F3F4F6]">
                      {activity.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
                            <Clock3 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-[#111827]">{item.text}</div>
                            <div className="mt-1 text-xs text-[#6B7280]">{item.time}</div>
                          </div>
                          <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <div className="border-b border-[#E5E7EB] px-5 py-4 text-lg font-semibold">Tally Sync History</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                          <tr>
                            <th className="px-4 py-3 font-medium">Time</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Entries</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Company</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncHistory.map((item) => (
                            <tr key={item.id} className="border-b border-[#F3F4F6]">
                              <td className="px-4 py-3">{item.time}</td>
                              <td className="px-4 py-3">{item.type}</td>
                              <td className="px-4 py-3">{item.entries}</td>
                              <td className="px-4 py-3">
                                <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                              </td>
                              <td className="px-4 py-3">{item.company}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activePage === "bank" ? (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <FileDropCard
                      title="Upload bank statement"
                      helper="Upload a PDF statement and review AI-mapped ledger suggestions in the table."
                      accept="application/pdf"
                      onSelect={handleBankUpload}
                    />
                    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[13px] text-[#6B7280]">Total Debits</div>
                          <div className="mt-1 text-xl font-semibold text-[#111827]">{formatCurrency(bankRows.reduce((sum, row) => sum + row.debit, 0))}</div>
                        </div>
                        <div>
                          <div className="text-[13px] text-[#6B7280]">Total Credits</div>
                          <div className="mt-1 text-xl font-semibold text-[#111827]">{formatCurrency(bankRows.reduce((sum, row) => sum + row.credit, 0))}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <EntryTable
                    title="Entry Management"
                    subtitle="Review mapped bank transactions, update debit/credit or ledger values, and push only the rows you trust."
                    rows={bankRows}
                    ledgerOptions={ledgerOptions}
                    filters={bankFilters}
                    onFiltersChange={setBankFilters}
                    selectedRowIds={bankSelected}
                    onToggleRow={(id) => toggleRow(bankSelected, setBankSelected, id)}
                    onToggleAll={() => toggleAll(getVisibleRows(bankRows, bankFilters), bankSelected, setBankSelected)}
                    onFieldChange={(id, field, value) => updateRowCollection(setBankRows, id, field, value)}
                    onApproveSelected={(ledger) => approveSelected(setBankRows, bankSelected, ledger)}
                    onMapSuspense={() => mapSuspense(setBankRows)}
                    onExport={() => exportRowsToExcel(bankRows, "bank-entries.xlsx", bankFilters)}
                    onSendToTally={handleBankPush}
                    recommendationCards={bankRecommendationCards}
                    onApproveRecommendation={(id) => {
                      setBankRows((current) => current.map((row) => (row.id === id ? { ...row, status: "resolved" } : row)));
                      withFlash([id]);
                    }}
                    aiHint={bankHint}
                    onAiHintChange={setBankHint}
                    onApplyAiHint={handleBankHintApply}
                    flashRowIds={flashRowIds}
                  />
                </div>
              </div>
            ) : null}

            {activePage === "invoice" ? (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <FileDropCard
                      title="Upload invoice or image"
                      helper="Review extracted invoice fields and line items before sending a purchase voucher to Tally."
                      accept="application/pdf,image/png,image/jpeg"
                      onSelect={handleInvoiceUpload}
                    />
                    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <div className="text-[13px] text-[#6B7280]">Invoice</div>
                      <div className="mt-2 text-base font-semibold text-[#111827]">{invoice.invoiceNumber || "Awaiting upload"}</div>
                      <div className="mt-1 text-sm text-[#6B7280]">{invoice.vendorName || "Vendor name will appear here"}</div>
                    </div>
                  </div>

                  <EntryTable
                    title="Invoice Line Entry Management"
                    subtitle="Edit extracted line items, adjust amounts, and confirm the purchase voucher before pushing."
                    rows={invoiceRows}
                    ledgerOptions={ledgerOptions}
                    filters={invoiceFilters}
                    onFiltersChange={setInvoiceFilters}
                    selectedRowIds={invoiceSelected}
                    onToggleRow={(id) => toggleRow(invoiceSelected, setInvoiceSelected, id)}
                    onToggleAll={() => toggleAll(getVisibleRows(invoiceRows, invoiceFilters), invoiceSelected, setInvoiceSelected)}
                    onFieldChange={(id, field, value) => updateRowCollection(setInvoiceRows, id, field, value)}
                    onApproveSelected={(ledger) => approveSelected(setInvoiceRows, invoiceSelected, ledger)}
                    onMapSuspense={() => mapSuspense(setInvoiceRows)}
                    onExport={() => exportRowsToExcel(invoiceRows, "invoice-entries.xlsx", invoiceFilters)}
                    onSendToTally={handleInvoicePush}
                    recommendationCards={invoiceCards}
                    onApproveRecommendation={(id) => {
                      setInvoiceRows((current) => current.map((row) => (row.id === id ? { ...row, status: "resolved" } : row)));
                      withFlash([id]);
                    }}
                    aiHint={invoiceHint}
                    onAiHintChange={setInvoiceHint}
                    onApplyAiHint={handleInvoiceHintApply}
                    flashRowIds={flashRowIds}
                  />
                </div>
              </div>
            ) : null}

            {activePage === "recommendations" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <FileDropCard
                    title="Upload recommendation sheet"
                    helper="Upload a Tally or bank export and review the suggested ledger mapping queue."
                    accept=".xlsx,.xls,.csv"
                    onSelect={handleRecommendationUpload}
                  />
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <div className="text-[13px] text-[#6B7280]">Learned mappings</div>
                    <div className="mt-1 text-xl font-semibold text-[#111827]">{formatNumber(recommendations.learningSummary?.learnedRuleCount || 0)}</div>
                    <div className="mt-2 text-sm text-[#6B7280]">Stored review patterns improving future classification.</div>
                  </div>
                </div>

                <EntryTable
                  title="Speedy Recommendation Queue"
                  subtitle="Approve AI ledger suggestions in bulk, adjust voucher types or values, and push only the resolved entries to Tally."
                  rows={recommendationRows}
                  ledgerOptions={ledgerOptions}
                  filters={recommendationFilters}
                  onFiltersChange={setRecommendationFilters}
                  selectedRowIds={recommendationSelected}
                  onToggleRow={(id) => toggleRow(recommendationSelected, setRecommendationSelected, id)}
                  onToggleAll={() => toggleAll(getVisibleRows(recommendationRows, recommendationFilters), recommendationSelected, setRecommendationSelected)}
                  onFieldChange={(id, field, value) => updateRowCollection(setRecommendationRows, id, field, value)}
                  onApproveSelected={(ledger) => approveSelected(setRecommendationRows, recommendationSelected, ledger)}
                  onMapSuspense={() => mapSuspense(setRecommendationRows)}
                  onExport={() => exportRowsToExcel(recommendationRows, "speedy-recommendations.xlsx", recommendationFilters)}
                  onSendToTally={handleRecommendationPush}
                  recommendationCards={recommendationCards}
                  onApproveRecommendation={approveRecommendationCard}
                  aiHint={recommendationHint}
                  onAiHintChange={setRecommendationHint}
                  onApplyAiHint={handleRecommendationHintApply}
                  flashRowIds={flashRowIds}
                />
              </div>
            ) : null}

            {activePage === "gst" ? (
              <GstPage report={gstReport} onReconcile={handleReconcile} />
            ) : null}

            {activePage === "history" ? (
              <HistoryPage activity={activity} syncHistory={syncHistory} />
            ) : null}

            {activePage === "settings" ? (
              <SettingsPage
                form={settingsForm}
                setForm={setSettingsForm}
                testConnectionResult={testConnectionResult}
                onTestConnection={handleTestConnection}
                onConnectTally={handlePairing}
                tallyStatus={tallyStatus}
              />
            ) : null}
          </main>
        </div>
      </div>

      <PairingModal open={pairingModalOpen} code={pairingCode} connected={tallyStatus.tallyConnected} onClose={() => setPairingModalOpen(false)} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}

function GstPage({ report, onReconcile }) {
  const [files, setFiles] = useState({ gstr2b: null, purchaseRegister: null });

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <FileDropCard title={files.gstr2b?.name || "Upload GSTR-2B"} helper="Excel or PDF export from GST portal." accept=".xlsx,.xls,.csv,application/pdf" onSelect={(file) => setFiles((current) => ({ ...current, gstr2b: file }))} />
        <FileDropCard title={files.purchaseRegister?.name || "Upload purchase register"} helper="Excel or PDF purchase register for the same period." accept=".xlsx,.xls,.csv,application/pdf" onSelect={(file) => setFiles((current) => ({ ...current, purchaseRegister: file }))} />
        <Button variant="primary" className="w-full justify-center" disabled={!files.gstr2b || !files.purchaseRegister} onClick={() => onReconcile(files.gstr2b, files.purchaseRegister)}>
          Reconcile
        </Button>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="grid gap-4 border-b border-[#E5E7EB] px-5 py-4 md:grid-cols-3">
          <StatMini label="Matched" value={formatNumber(report.summary.matched)} tone="text-[#16A34A]" />
          <StatMini label="Partial" value={formatNumber(report.summary.partial)} tone="text-[#D97706]" />
          <StatMini label="Unmatched" value={formatNumber(report.summary.unmatched)} tone="text-[#DC2626]" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">GSTIN</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F3F4F6] bg-white hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Badge status={row.status === "matched" ? "resolved" : row.status === "partial" ? "pending" : "failed"} confidence="medium" />
                  </td>
                  <td className="px-4 py-3">{row.invoiceNumber}</td>
                  <td className="px-4 py-3">{row.gstin || "—"}</td>
                  <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.mismatchReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HistoryPage({ activity, syncHistory }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="border-b border-[#E5E7EB] px-5 py-4 text-lg font-semibold">Recent Activity</div>
        <div className="divide-y divide-[#F3F4F6]">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="text-sm text-[#111827]">{item.text}</div>
                <div className="mt-1 text-xs text-[#6B7280]">{item.time}</div>
              </div>
              <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="border-b border-[#E5E7EB] px-5 py-4 text-lg font-semibold">Tally Sync History</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-[0.08em] text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Entries</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Company</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((item) => (
                <tr key={item.id} className="border-b border-[#F3F4F6]">
                  <td className="px-4 py-3">{item.time}</td>
                  <td className="px-4 py-3">{item.type}</td>
                  <td className="px-4 py-3">{item.entries}</td>
                  <td className="px-4 py-3">
                    <Badge status={item.status === "Resolved" ? "resolved" : item.status === "Failed" ? "failed" : "pending"} confidence="high" />
                  </td>
                  <td className="px-4 py-3">{item.company}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ form, setForm, testConnectionResult, onTestConnection, onConnectTally, tallyStatus }) {
  return (
    <div className="space-y-6">
      <SettingsCard title="Tally Connection">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Server IP">
            <input value={form.host} onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))} className="settings-input" />
          </Field>
          <Field label="Port">
            <input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} className="settings-input" />
          </Field>
          <Field label="Company Name">
            <input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} className="settings-input" />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outlinePurple" onClick={onTestConnection}>
            {testConnectionResult === "Connected" ? <Check className="h-4 w-4" /> : null}
            Test Connection
          </Button>
          {testConnectionResult ? <span className={cn("text-sm", testConnectionResult === "Connected" ? "text-[#16A34A]" : "text-[#DC2626]")}>{testConnectionResult}</span> : null}
        </div>
      </SettingsCard>

      <SettingsCard title="API Configuration">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Anthropic API Key">
            <div className="flex items-center gap-2">
              <input
                type={form.showApiKey ? "text" : "password"}
                value={form.anthropicApiKey}
                onChange={(event) => setForm((current) => ({ ...current, anthropicApiKey: event.target.value }))}
                className="settings-input flex-1"
                placeholder="Server-managed key"
              />
              <Button variant="ghost" onClick={() => setForm((current) => ({ ...current, showApiKey: !current.showApiKey }))}>
                {form.showApiKey ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>
          <div className="md:self-end">
            <Button variant="outlinePurple">Test AI</Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Connector Status">
        <div className="grid gap-4 md:grid-cols-4">
          <StatMini label="Connector" value={tallyStatus.connectorConnected ? "Active" : "Disconnected"} tone={tallyStatus.connectorConnected ? "text-[#16A34A]" : "text-[#DC2626]"} />
          <StatMini label="Last heartbeat" value={tallyStatus.lastSeen ? formatDate(tallyStatus.lastSeen) : "Never"} tone="text-[#111827]" />
          <StatMini label="Device ID" value={form.deviceId || "Pending"} tone="text-[#111827]" />
          <div className="flex items-end">
            <Button variant="danger" onClick={onConnectTally}>
              Disconnect
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="border-b border-[#E5E7EB] px-5 py-4 text-lg font-semibold text-[#111827]">{title}</div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-[#374151]">{label}</div>
      {children}
    </label>
  );
}

function StatMini({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <div className="text-[13px] text-[#6B7280]">{label}</div>
      <div className={cn("mt-2 text-xl font-semibold", tone)}>{value}</div>
    </div>
  );
}

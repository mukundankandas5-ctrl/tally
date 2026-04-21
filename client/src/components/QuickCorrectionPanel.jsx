import { useState } from "react";
import { recordMLFeedback } from "../utils/api";

export default function QuickCorrectionPanel({ 
  transactionId, 
  currentLedger, 
  currentVoucherType,
  narration,
  amount,
  onCorrected,
  ledgerOptions = [],
  voucherTypeOptions = ["Receipt", "Payment", "Journal", "Contra"]
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(currentLedger);
  const [selectedVoucher, setSelectedVoucher] = useState(currentVoucherType);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmitCorrection = async () => {
    if (!selectedLedger || !selectedVoucher) {
      setSubmitStatus({ type: "error", message: "Please select both ledger and voucher type" });
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitStatus(null);

      const correctionData = {
        transactionId,
        originalClassification: {
          ledger: currentLedger,
          voucherType: currentVoucherType,
        },
        userCorrection: {
          ledger: selectedLedger,
          voucherType: selectedVoucher,
          feedback,
        },
      };

      await recordMLFeedback(
        transactionId,
        correctionData.originalClassification,
        correctionData.userCorrection
      );

      setSubmitStatus({
        type: "success",
        message: "✓ Correction saved! ML model is learning from your input.",
      });

      // Call callback to update parent component
      if (onCorrected) {
        onCorrected({
          ledger: selectedLedger,
          voucherType: selectedVoucher,
        });
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setShowPanel(false);
        setSelectedLedger(currentLedger);
        setSelectedVoucher(currentVoucherType);
        setFeedback("");
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: `Failed to save correction: ${error.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="rounded px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition"
        title="Correct this classification"
      >
        ✏ Correct
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Quick Correction</h3>
            <p className="text-xs text-slate-500 mt-1">{narration}</p>
            <p className="text-xs text-slate-500">₹{amount}</p>
          </div>
          <button
            onClick={() => setShowPanel(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {submitStatus && (
          <div
            className={`mb-4 rounded-lg px-3 py-2 text-sm font-medium ${
              submitStatus.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {submitStatus.message}
          </div>
        )}

        <div className="space-y-4">
          {/* Current Classification */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Current Classification</p>
            <div className="flex gap-2">
              <span className="inline-block rounded bg-white px-2 py-1 text-xs border border-slate-200">
                {currentLedger || "Not set"}
              </span>
              <span className="inline-block rounded bg-white px-2 py-1 text-xs border border-slate-200">
                {currentVoucherType || "Not set"}
              </span>
            </div>
          </div>

          {/* Corrected Classification */}
          <div>
            <label className="label-base">Correct Ledger</label>
            <select
              value={selectedLedger}
              onChange={(e) => setSelectedLedger(e.target.value)}
              className="input-base"
            >
              <option value="">Select ledger...</option>
              {ledgerOptions.map((ledger) => (
                <option key={ledger} value={ledger}>
                  {ledger}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-base">Correct Voucher Type</label>
            <select
              value={selectedVoucher}
              onChange={(e) => setSelectedVoucher(e.target.value)}
              className="input-base"
            >
              <option value="">Select voucher type...</option>
              {voucherTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Feedback */}
          <div>
            <label className="label-base">Optional Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Why is this correction needed? (helps improve the model)"
              className="input-base min-h-[80px]"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-slate-500">{feedback.length}/200 characters</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmitCorrection}
              disabled={isSubmitting || !selectedLedger || !selectedVoucher}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save Correction"}
            </button>
            <button
              onClick={() => setShowPanel(false)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 border border-blue-200">
          <p>💡 Your correction helps the ML model improve. Thank you for making it smarter!</p>
        </div>
      </div>
    </div>
  );
}

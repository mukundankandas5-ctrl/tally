import { useState } from "react";
import { Check, Download, Landmark, ArrowRight, CheckCircle2 } from "lucide-react";
import { updateOnboardingStatus } from "../utils/api";

export function OnboardingWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const steps = [
    { id: 1, title: "Welcome" },
    { id: 2, title: "Download" },
    { id: 3, title: "Connect" },
    { id: 4, title: "Done" },
  ];

  const handleComplete = async () => {
    setBusy(true);
    try {
      await updateOnboardingStatus(user.id, true);
      onComplete();
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7C3AED_0%,#4F46E5_100%)] text-white shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">Tally AI</span>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`h-8 w-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${step >= s.id ? 'bg-[#7C3AED] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                  {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                </div>
                {s.id !== steps.length && <div className={`h-1 w-8 rounded-full ${step > s.id ? 'bg-[#7C3AED]' : 'bg-[#F3F4F6]'}`} />}
              </div>
            ))}
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl bg-white">
            {step === 1 && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F5F3FF] text-[#7C3AED] mb-8">
                  <Landmark className="h-10 w-10" />
                </div>
                <h1 className="text-4xl font-bold text-[#111827] mb-4">Welcome to Tally AI</h1>
                <p className="text-lg text-[#6B7280] mb-10 max-w-lg mx-auto">
                  Automate your accounting with AI. Connect TallyPrime to auto-categorize bank statements, process invoices, and reconcile GST effortlessly.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#6D28D9]"
                >
                  Get Started <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F0FDF4] text-[#16A34A] mb-8">
                  <Download className="h-10 w-10" />
                </div>
                <h1 className="text-3xl font-bold text-[#111827] mb-4">Download the Connector</h1>
                <p className="text-lg text-[#6B7280] mb-8 max-w-lg mx-auto">
                  To sync data with TallyPrime, install the Windows Connector app on the PC where TallyPrime is running.
                </p>
                <div className="mx-auto bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-6 text-left max-w-md mb-8">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] font-bold text-[#4B5563]">1</div>
                    <p className="text-sm text-[#374151]">Download and run the installer on your Windows PC.</p>
                  </div>
                  <div className="flex items-start gap-4 mt-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] font-bold text-[#4B5563]">2</div>
                    <p className="text-sm text-[#374151]">Ensure TallyPrime is open and a company is loaded.</p>
                  </div>
                </div>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setStep(1)} className="rounded-xl border border-[#D1D5DB] bg-white px-6 py-3 font-semibold text-[#374151] hover:bg-[#F9FAFB]">Back</button>
                  <a href="/api/connector-download" className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-3 font-semibold text-white hover:bg-[#374151]">
                    Download .exe
                  </a>
                  <button onClick={() => setStep(3)} className="rounded-xl bg-[#7C3AED] px-8 py-3 font-semibold text-white hover:bg-[#6D28D9]">Next Step</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-3xl font-bold text-[#111827] mb-4">Connect Your App</h1>
                <p className="text-lg text-[#6B7280] mb-8 max-w-lg mx-auto">
                  Open the Tally AI Connector on your PC and enter a pairing code from the Settings page.
                </p>
                <div className="bg-[#F5F3FF] border border-[#E9D5FF] rounded-2xl p-8 mb-8">
                  <p className="text-sm font-medium text-[#7C3AED] uppercase tracking-wider mb-2">Instructions</p>
                  <ul className="text-left text-[#4B5563] space-y-3 max-w-sm mx-auto list-disc pl-5">
                    <li>Launch <strong>TallyPrime</strong></li>
                    <li>Launch <strong>Tally AI Connector</strong></li>
                    <li>Click <strong>Generate Pairing Code</strong> in your Dashboard Settings</li>
                    <li>Enter the code in the connector</li>
                  </ul>
                </div>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setStep(2)} className="rounded-xl border border-[#D1D5DB] bg-white px-6 py-3 font-semibold text-[#374151] hover:bg-[#F9FAFB]">Back</button>
                  <button onClick={() => setStep(4)} className="rounded-xl bg-[#7C3AED] px-8 py-3 font-semibold text-white hover:bg-[#6D28D9]">I've Understood</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-lg shadow-[#16A34A]/30 mb-8">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h1 className="text-4xl font-bold text-[#111827] mb-4">You're All Set!</h1>
                <p className="text-lg text-[#6B7280] mb-10 max-w-lg mx-auto">
                  Welcome to your new automated workspace. Let's start saving hours of data entry.
                </p>
                <button
                  disabled={busy}
                  onClick={handleComplete}
                  className="rounded-xl bg-[#111827] px-10 py-4 text-lg font-semibold text-white hover:bg-[#374151] transition disabled:opacity-50"
                >
                  {busy ? "Finalizing..." : "Enter Dashboard"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

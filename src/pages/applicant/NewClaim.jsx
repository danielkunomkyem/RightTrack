import { useState } from "react";
import { Check, ChevronRight, ArrowLeft, Star, MessageSquareText, Lock, Loader2, ShieldCheck } from "lucide-react";
import { Card, Field, Row } from "../../components/UI.jsx";
import FileDrop from "../../components/FileDrop.jsx";
import { fmtMoney, insurerRatingStats } from "../../lib/helpers.js";
import { validatePolicyRequest } from "../../lib/api.js";

function InsurerRatingPanel({ claims, insurer }) {
  if (!insurer) return null;
  const stats = insurerRatingStats(claims, insurer);
  return (
    <div className="mt-3 rounded-xl bg-navy-50/70 ring-1 ring-navy-900/6 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-900">{insurer}</p>
        {stats.count > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-900 num">
            <Star className="w-4 h-4 text-brass-500" fill="currentColor" />{stats.avg.toFixed(1)}
            <span className="text-xs text-ink-500 font-normal">({stats.count} rating{stats.count === 1 ? "" : "s"})</span>
          </span>
        ) : (
          <span className="text-xs text-ink-400">No ratings yet</span>
        )}
      </div>
      {stats.reviews.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-navy-900/6 space-y-2">
          {stats.reviews.slice(0, 3).map((r, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} className={`w-3 h-3 ${s < r.stars ? "text-brass-500" : "text-ink-900/10"}`} fill="currentColor" />)}
              </div>
              <p className="text-ink-600 mt-0.5">"{r.review}"</p>
            </div>
          ))}
        </div>
      )}
      {stats.count === 0 && (
        <p className="text-xs text-ink-500 mt-1.5 inline-flex items-center gap-1.5"><MessageSquareText className="w-3.5 h-3.5" />Be the first to rate this insurer once your claim is resolved.</p>
      )}
    </div>
  );
}

export default function NewClaimWizard({ claims, profile, onSubmitClaim, pushToast }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ fullName: profile?.fullName || "", policyId: "", amount: "", description: "" });
  const [policyCheck, setPolicyCheck] = useState({ status: "idle", policy: null, message: "" });
  const [files, setFiles] = useState([]);
  const [refId, setRefId] = useState(null);
  const steps = ["Claim Details", "Upload Documents", "Review & Confirm", "Submit Claim"];

  const selectedPolicy = policyCheck.policy;
  const policyValidated = policyCheck.status === "valid" && selectedPolicy?.policyId === form.policyId;

  const canNext1 = form.fullName && policyValidated && Number(form.amount) > 0 && form.description.length > 10;
  const canNext2 = files.length > 0;

  const updatePolicyId = (value) => {
    setForm((current) => ({ ...current, policyId: value.toUpperCase().trimStart() }));
    setPolicyCheck({ status: "idle", policy: null, message: "" });
  };

  const validatePolicy = async () => {
    const policyId = form.policyId.trim();
    if (!policyId || policyCheck.status === "checking") return;
    setPolicyCheck({ status: "checking", policy: null, message: "Checking policy…" });
    try {
      const response = await validatePolicyRequest(policyId);
      setForm((current) => ({ ...current, policyId: response.policy.policyId }));
      setPolicyCheck({ status: "valid", policy: response.policy, message: response.message });
    } catch (err) {
      setPolicyCheck({ status: "invalid", policy: null, message: err.message });
    }
  };

  const submit = async () => {
    const claimId = await onSubmitClaim({
      policyId: form.policyId,
      amount: Number(form.amount), description: form.description, documents: files,
    });
    if (claimId) {
      setRefId(claimId);
      setStep(5);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-semibold text-navy-900 mb-6">New Claim</h1>
      {step <= 4 && (
        <div className="flex items-center mb-8">
          {steps.map((s, i) => (
            <div key={s} className="contents">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i + 1 < step ? "bg-emerald-500 text-white" : i + 1 === step ? "bg-bearing-600 text-white" : "bg-white ring-2 ring-ink-900/10 text-ink-300"
                  }`}
                >
                  {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block ${i + 1 <= step ? "text-navy-900" : "text-ink-300"}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-[2px] mx-2 ${i + 1 < step ? "bg-emerald-500" : "bg-ink-900/10"}`}></div>}
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <Card className="p-6">
          <p className="font-display font-semibold text-navy-900">Claim Details</p>
          <p className="text-xs text-ink-500 mt-1 mb-5">Please provide the details of your claim.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <div className="input bg-ink-900/[0.03] text-ink-500 cursor-not-allowed flex items-center justify-between gap-2">
                <span className="truncate">{form.fullName || "Not set on your profile"}</span>
                <Lock className="w-3.5 h-3.5 shrink-0 text-ink-300" />
              </div>
            </Field>
            <Field label="Policy Number" full>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={form.policyId}
                  onChange={(e) => updatePolicyId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      validatePolicy();
                    }
                  }}
                  placeholder="Enter your policy number, e.g. POL-4A8C12EF"
                  className="input flex-1 font-mono uppercase"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={validatePolicy}
                  disabled={!form.policyId.trim() || policyCheck.status === "checking"}
                  className="btn-primary justify-center sm:min-w-36 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {policyCheck.status === "checking" ? <><Loader2 className="w-4 h-4 animate-spin" />Checking…</> : "Validate Policy"}
                </button>
              </div>
              <p className="text-[11px] text-ink-400 mt-1.5">The policy must be active and assigned to the email address used for this account.</p>
              {policyCheck.status === "valid" && (
                <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />{policyCheck.message}
                </p>
              )}
              {policyCheck.status === "invalid" && (
                <p className="mt-2 text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{policyCheck.message}</p>
              )}
            </Field>
            {!profile?.fullName && (
              <p className="sm:col-span-2 text-[11px] text-brass-600 bg-brass-500/10 rounded-lg px-3 py-2 -mt-1">
                Your full name is missing. Update it from Settings before filing a claim.
              </p>
            )}
            <Field label="Receiving Organization" full>
              <div className="input bg-ink-900/[0.03] text-ink-500 cursor-not-allowed flex items-center justify-between gap-2">
                <span className="truncate">{selectedPolicy?.insurer || "Selected automatically from your policy"}</span>
                <Lock className="w-3.5 h-3.5 shrink-0 text-ink-300" />
              </div>
              <InsurerRatingPanel claims={claims} insurer={selectedPolicy?.insurer} />
            </Field>
            <Field label="Claim Category">
              <div className="input bg-ink-900/[0.03] text-ink-500 cursor-not-allowed flex items-center justify-between gap-2">
                <span className="truncate">{selectedPolicy?.category || "Selected automatically from your policy"}</span>
                <Lock className="w-3.5 h-3.5 shrink-0 text-ink-300" />
              </div>
            </Field>
            <Field label="Claim Amount (₦)"><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="250000" className="input" /></Field>
            <Field label="Description of Claim" full>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="What happened? Please provide as much detail as possible." className="input resize-none" />
            </Field>
          </div>
          <div className="flex justify-end mt-6">
            <button disabled={!canNext1} onClick={() => setStep(2)} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">Continue <ChevronRight className="w-4 h-4" /></button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <p className="font-display font-semibold text-navy-900">Upload Supporting Documents</p>
          <p className="text-xs text-ink-500 mt-1 mb-5">Please upload all relevant documents that support your claim.</p>
          <FileDrop files={files} setFiles={setFiles} pushToast={pushToast} />
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="btn-ghost"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button disabled={!canNext2} onClick={() => setStep(3)} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">Continue <ChevronRight className="w-4 h-4" /></button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <p className="font-display font-semibold text-navy-900">Review your claim</p>
          <p className="text-xs text-ink-500 mt-1 mb-5">Please review all details before submitting.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold uppercase text-ink-500 mb-2">Claim Details</p>
              <dl className="text-sm space-y-2">
                <Row k="Full Name" v={form.fullName} /><Row k="Policy ID" v={form.policyId} /><Row k="Organization" v={selectedPolicy?.insurer} /><Row k="Category" v={selectedPolicy?.category} />
                <Row k="Amount" v={fmtMoney(form.amount || 0)} />
              </dl>
              <p className="text-xs font-bold uppercase text-ink-500 mt-4 mb-1.5">Description</p>
              <p className="text-sm text-ink-700 leading-relaxed">{form.description}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-ink-500 mb-2">Uploaded Documents</p>
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-navy-50/60 text-sm">
                    <span className="flex-1 truncate">{f.name}</span><span className="text-xs text-ink-500">{f.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 text-xs bg-bearing-100 text-bearing-700 rounded-lg px-3.5 py-2.5">You can go back to edit any section before final submission.</div>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(2)} className="btn-ghost"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => setStep(4)} className="btn-primary">Continue <ChevronRight className="w-4 h-4" /></button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6">
          <p className="font-display font-semibold text-navy-900">Submit your claim</p>
          <p className="text-xs text-ink-500 mt-1 mb-5">You're almost done. Confirm below to submit your claim for review.</p>
          <div className="space-y-3">
            {[
              ["We'll review your claim", "Our team reviews your submitted information."],
              ["You'll be updated", "Real-time updates as your claim status changes."],
              ["Clarification if needed", "We'll ask if we need more information."],
              ["Final decision", "You'll be notified once a decision is made."],
            ].map(([t, d], i) => (
              <div key={t} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</span>
                <div><p className="text-sm font-semibold text-navy-900">{t}</p><p className="text-xs text-ink-500">{d}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-5 text-xs bg-bearing-100 text-bearing-700 rounded-lg px-3.5 py-2.5">By submitting, you confirm that all information provided is accurate and documents are genuine.</div>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(3)} className="btn-ghost"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={submit} className="btn-primary">Submit Claim</button>
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-6 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><Check className="w-6 h-6" /></div>
          <p className="font-display text-xl font-semibold text-navy-900 mt-4">Claim Submitted Successfully!</p>
          <p className="text-sm text-ink-500 mt-1">Your claim has been received and is now being processed.</p>
          <p className="text-xs text-ink-500 mt-1">Automatically routed to <span className="font-semibold text-navy-900">{selectedPolicy?.insurer}</span> from your verified policy.</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 max-w-md mx-auto">
            <div><p className="text-[11px] text-ink-500">Reference ID</p><p className="font-mono font-semibold text-navy-900 text-sm">{refId}</p></div>
            <div><p className="text-[11px] text-ink-500">Status</p><p className="font-semibold text-emerald-600 text-sm">Submitted</p></div>
            <div><p className="text-[11px] text-ink-500">Est. Resolution</p><p className="font-semibold text-navy-900 text-sm">≤ 48 hours</p></div>
          </div>
          <button onClick={() => onSubmitClaim(null, refId)} className="btn-primary mt-7">Track My Claim</button>
        </Card>
      )}
    </div>
  );
}

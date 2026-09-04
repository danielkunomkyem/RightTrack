import { Building2, FileBadge, ShieldCheck } from "lucide-react";
import { Card } from "../../components/UI.jsx";
import { CATEGORY_META } from "../../lib/constants.js";
import { fmtDate } from "../../lib/helpers.js";

export default function MyPolicies({ policies = [] }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-navy-900">My Policies</h1>
        <p className="text-sm text-ink-500 mt-1">Active policies assigned to your verified email by an approved organization.</p>
      </div>

      {policies.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-700 flex items-center justify-center mx-auto">
            <FileBadge className="w-6 h-6" />
          </div>
          <h2 className="font-display font-semibold text-navy-900 mt-4">No policy assigned yet</h2>
          <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">Ask your insurer to assign a policy to the same email address used for this account.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {policies.map((policy) => {
            const category = CATEGORY_META[policy.category] || { color: "#1e4fd9", bg: "#e8edfd" };
            return (
              <Card key={policy._id || policy.policyId} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: category.bg, color: category.color }}>
                    <FileBadge className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />Active
                  </span>
                </div>
                <p className="font-display text-lg font-semibold text-navy-900 mt-4">{policy.policyId}</p>
                <p className="text-sm text-ink-700 mt-1">{policy.category}</p>
                <div className="border-t border-ink-900/8 mt-4 pt-4 space-y-2 text-xs text-ink-500">
                  <p className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />{policy.insurer}</p>
                  {policy.createdAt && <p>Assigned {fmtDate(policy.createdAt)}</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

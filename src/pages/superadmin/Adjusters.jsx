import { useEffect, useState } from "react";
import { Search, Mail, Phone, MessageSquare, Ban, CheckCircle2, Star, Plus, BadgeCheck, Building2, Hash, ShieldCheck } from "lucide-react";
import { Card, Modal, Field, Select } from "../../components/UI.jsx";
import MessageModal from "../../components/MessageModal.jsx";
import { ADJUSTER_STATUS_META } from "../../lib/constants.js";
import { slaInfo, fmtDate } from "../../lib/helpers.js";
import {
  listPendingOrganizationsRequest,
  approveOrganizationRequest,
  rejectOrganizationRequest,
  listPendingAdjustersRequest,
  approveAdjusterRequest,
  rejectAdjusterRequest,
} from "../../lib/api.js";

function VerificationQueue({ pushToast }) {
  const [organizations, setOrganizations] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([listPendingOrganizationsRequest(), listPendingAdjustersRequest()])
      .then(([orgResult, adjusterResult]) => {
        setOrganizations(orgResult.organizations);
        setPending(adjusterResult.adjusters);
      })
      .catch((err) => pushToast({ type: "warn", title: "Couldn't load verification queue", body: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApproveOrganization = async (organization) => {
    try {
      await approveOrganizationRequest(organization._id);
      pushToast({ type: "success", title: "Organization approved", body: `${organization.name} passed verification.` });
      setOrganizations((prev) => prev.filter((item) => item._id !== organization._id));
      setPending((prev) => prev.map((adjuster) => (
        adjuster.organization?._id === organization._id
          ? { ...adjuster, organization: { ...adjuster.organization, status: "approved" } }
          : adjuster
      )));
    } catch (err) {
      pushToast({ type: "warn", title: "Approval failed", body: err.message });
    }
  };

  const handleApprove = async (a) => {
    try {
      await approveAdjusterRequest(a._id);
      pushToast({ type: "success", title: "Adjuster approved", body: `${a.fullName} can now log in.` });
      setPending((prev) => prev.filter((x) => x._id !== a._id));
    } catch (err) {
      pushToast({ type: "warn", title: "Approval failed", body: err.message });
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    if (!note.trim()) return;
    try {
      if (rejecting.type === "organization") {
        await rejectOrganizationRequest(rejecting.item._id, note);
        pushToast({ type: "warn", title: "Organization rejected", body: `${rejecting.item.name}'s application was declined.` });
        setOrganizations((prev) => prev.filter((item) => item._id !== rejecting.item._id));
        setPending((prev) => prev.map((adjuster) => (
          adjuster.organization?._id === rejecting.item._id
            ? { ...adjuster, organization: { ...adjuster.organization, status: "rejected" } }
            : adjuster
        )));
      } else {
        await rejectAdjusterRequest(rejecting.item._id, note);
        pushToast({ type: "warn", title: "Adjuster rejected", body: `${rejecting.item.fullName}'s application was declined.` });
        setPending((prev) => prev.filter((x) => x._id !== rejecting.item._id));
      }
      setRejecting(null);
      setNote("");
    } catch (err) {
      pushToast({ type: "warn", title: "Rejection failed", body: err.message });
    }
  };

  if (loading) {
    return <Card className="p-5 text-sm text-ink-500">Loading organization and adjuster verification queue…</Card>;
  }

  const organizationStatusClass = {
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    rejected: "bg-red-50 text-red-700 ring-red-200",
    suspended: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy-900">Verification Queue</h2>
        <p className="text-ink-500 text-sm mt-0.5">Approve the legal organization first, then verify each adjuster's employment credentials.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-navy-900">1. Organizations</h3>
          <span className="text-xs font-semibold text-ink-400">{organizations.length} pending</span>
        </div>
        {organizations.length === 0 ? (
          <Card className="p-4 text-sm text-ink-500">No organization applications are waiting.</Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {organizations.map((organization) => (
              <Card key={organization._id} className="p-5 ring-1 ring-amber-200 bg-amber-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold text-navy-900">{organization.name}</p>
                    <p className="text-xs text-ink-500">Submitted by {organization.submittedBy?.fullName || "an adjuster"}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200">Pending</span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-ink-700">
                  <p className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-ink-400" />CAC: <span className="font-semibold">{organization.cacNumber}</span></p>
                  <p className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-ink-400" />Regulatory licence: <span className="font-semibold">{organization.naicomLicenseNumber}</span></p>
                  <p className="text-ink-400">Submitted {fmtDate(organization.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {organization.claimCategories.map((category) => <span key={category} className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-700 text-[11px] font-medium">{category}</span>)}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setRejecting({ type: "organization", item: organization })} className="flex-1 text-xs py-2 rounded-xl font-semibold bg-red-50 text-red-700 hover:bg-red-100">Reject</button>
                  <button onClick={() => handleApproveOrganization(organization)} className="flex-1 text-xs py-2 rounded-xl font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Approve organization</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-navy-900">2. Adjusters</h3>
          <span className="text-xs font-semibold text-ink-400">{pending.length} pending</span>
        </div>
        {pending.length === 0 ? (
          <Card className="p-4 text-sm text-ink-500">No adjuster applications are waiting.</Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {pending.map((a) => {
              const organizationStatus = a.organization?.status || "pending";
              const organizationApproved = organizationStatus === "approved";
              return (
          <Card key={a._id} className="p-5 ring-1 ring-amber-200 bg-amber-50/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-navy-900">{a.fullName}</p>
                <p className="text-xs text-ink-500">{a.email}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${organizationStatusClass[organizationStatus]}`}>Org {organizationStatus}</span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-ink-700">
              <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-ink-400" />{a.organization?.name || a.orgName || "—"}</p>
              <p className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-ink-400" />License/Staff ID: <span className="font-semibold">{a.licenseNumber || "—"}</span></p>
              {a.claimCategories && a.claimCategories.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {a.claimCategories.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-700 text-[11px] font-medium">{c}</span>
                  ))}
                </div>
              )}
              <p className="text-ink-400">Applied {fmtDate(a.createdAt)}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRejecting({ type: "adjuster", item: a })} className="flex-1 text-xs py-2 rounded-xl font-semibold bg-red-50 text-red-700 hover:bg-red-100">Reject</button>
              <button disabled={!organizationApproved} title={organizationApproved ? "Approve this adjuster" : "Approve the organization first"} onClick={() => handleApprove(a)} className="flex-1 text-xs py-2 rounded-xl font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed">Approve adjuster</button>
            </div>
          </Card>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={!!rejecting} onClose={() => { setRejecting(null); setNote(""); }}>
        <div className="p-6">
          <p className="font-display font-semibold text-navy-900 text-lg">Reject {rejecting?.item?.name || rejecting?.item?.fullName}</p>
          <p className="text-xs text-ink-500 mt-1">Record a clear reason. It is saved to the audit trail and shown when the applicant tries to log in.</p>
          <Field label="Reason">
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. License number could not be verified" />
          </Field>
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={() => { setRejecting(null); setNote(""); }} className="btn-ghost flex-1">Cancel</button>
            <button type="button" disabled={!note.trim()} onClick={handleReject} className="flex-1 rounded-xl font-semibold bg-red-600 text-white py-2.5 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Confirm Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SuperAdminAdjusters({ adjusters, claims, onToggleStatus, onAddAdjuster, pushToast }) {
  const [q, setQ] = useState("");
  const [messaging, setMessaging] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", unit: "Claims Unit 1" });

  const rows = adjusters.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase()));

  const statsFor = (a) => {
    const owned = claims.filter((c) => c.adjuster === a.name);
    const attended = owned.filter((c) => c.status === "approved" || c.status === "rejected");
    const breached = owned.filter((c) => slaInfo(c).breached);
    const rated = owned.filter((c) => c.rating && c.rating.stars);
    const rating = rated.length ? rated.reduce((s, c) => s + c.rating.stars, 0) / rated.length : null;
    return { assigned: owned.length, attended: attended.length, breached: breached.length, rating };
  };

  const canInvite = form.name.trim().length > 1 && form.email.includes("@");
  const submitInvite = (e) => {
    e.preventDefault();
    if (!canInvite) return;
    onAddAdjuster(form);
    pushToast({ type: "success", title: "Adjuster invited", body: `${form.name} has been added to the roster.` });
    setForm({ name: "", email: "", phone: "", unit: "Claims Unit 1" });
    setInviting(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900">Adjusters</h1>
          <p className="text-ink-500 text-sm mt-1">Team roster, performance, and access control.</p>
        </div>
        <button onClick={() => setInviting(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Invite Adjuster</button>
      </div>

      <VerificationQueue pushToast={pushToast} />

      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email..." className="input pl-9 max-w-md" />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((a) => {
          const s = statsFor(a);
          const meta = ADJUSTER_STATUS_META[a.status];
          return (
            <Card key={a.id} className="p-5" hoverable>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-sm font-bold shrink-0">{a.name.split(" ").map((s) => s[0]).join("")}</div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-navy-900 truncate">{a.name}</p>
                    <p className="text-xs text-ink-500 truncate">{a.unit}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset shrink-0 ${meta.cls}`}>{meta.label}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-ink-500">
                <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{a.email}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{a.phone}</p>
                <p>On team since {fmtDate(a.joinedAt)}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-ink-900/6 text-center">
                <div><p className="font-display font-semibold text-navy-900 num">{s.assigned}</p><p className="text-[10px] text-ink-500 uppercase">Assigned</p></div>
                <div><p className="font-display font-semibold text-navy-900 num">{s.attended}</p><p className="text-[10px] text-ink-500 uppercase">Attended</p></div>
                <div><p className={`font-display font-semibold num ${s.breached ? "text-red-600" : "text-navy-900"}`}>{s.breached}</p><p className="text-[10px] text-ink-500 uppercase">Breached</p></div>
                <div><p className="font-display font-semibold text-navy-900 num flex items-center justify-center gap-0.5">{s.rating ? s.rating.toFixed(1) : "—"}{s.rating && <Star className="w-3 h-3 text-brass-500" fill="currentColor" />}</p><p className="text-[10px] text-ink-500 uppercase">Rating</p></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setMessaging(a)} className="btn-ghost flex-1 text-xs py-2"><MessageSquare className="w-3.5 h-3.5" />Message</button>
                <button
                  onClick={() => onToggleStatus(a.id)}
                  className={`flex-1 text-xs py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                    a.status === "active" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {a.status === "active" ? <><Ban className="w-3.5 h-3.5" />Suspend</> : <><CheckCircle2 className="w-3.5 h-3.5" />Reactivate</>}
                </button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-ink-500 col-span-2 text-center py-10">No adjusters match your search.</p>}
      </div>

      <MessageModal
        open={!!messaging}
        person={messaging}
        onClose={() => setMessaging(null)}
        onSend={({ subject }) => pushToast({ type: "success", title: `Message sent to ${messaging.name}`, body: subject })}
      />

      <Modal open={inviting} onClose={() => setInviting(false)}>
        <div className="p-6">
          <p className="font-display font-semibold text-navy-900 text-lg">Invite Adjuster</p>
          <p className="text-xs text-ink-500 mt-1">They'll get an email to set up their claims console access.</p>
          <form className="space-y-4 mt-5" onSubmit={submitInvite}>
            <Field label="Full Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jane Doe" required /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@righttrack.africa" required /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 ..." /></Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option>Claims Unit 1</option><option>Claims Unit 2</option><option>Claims Unit 3</option>
              </Select>
            </Field>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setInviting(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={!canInvite} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">Send Invite</button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

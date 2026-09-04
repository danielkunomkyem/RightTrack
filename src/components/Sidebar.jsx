import { useState } from "react";
import { LayoutDashboard, Plus, Folder, FileBadge, Code2, LogOut, Sparkles, CreditCard, ShieldAlert, UserRound, Settings, X } from "lucide-react";
import Logo from "./Logo.jsx";
import { Modal } from "./UI.jsx";
import { isPremiumPlan } from "../lib/constants.js";

export default function Sidebar({ role, plan, active, onNav, onExit, mobileOpen, setMobileOpen }) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const applicantNav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["new", "New Claim", Plus],
    ["claims", "My Claims", Folder],
    ["policies", "My Policies", FileBadge],
  ];
  const isPremium = isPremiumPlan(plan);
  const billingLabel = plan === "trial" ? "Manage Subscription" : plan === "premium" ? "Plans & Billing" : "Start Free Trial";
  const adminNav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["queue", "Claims Queue", Folder],
    ["policies", "Manage Policies", FileBadge],
    ["api", "Developer / API", Code2],
    ["billing", billingLabel, isPremium ? CreditCard : Sparkles],
  ];
  const superAdminNav = [
    ["sa-dashboard", "Overview", LayoutDashboard],
    ["sa-claims", "All Claims", Folder],
    ["sa-adjusters", "Adjusters", ShieldAlert],
    ["sa-policyholders", "Policyholders", UserRound],
  ];
  const items = role === "admin" ? adminNav : role === "superadmin" ? superAdminNav : applicantNav;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-[2px] z-40 lg:hidden" onClick={() => setMobileOpen(false)}></div>}
      <aside
className={`fixed inset-y-0 left-0 lg:sticky lg:inset-auto lg:top-0 h-[100dvh] lg:h-screen w-[78vw] max-w-72 lg:w-64 bg-navy-950 text-white flex flex-col z-50 transition-transform duration-300 shrink-0 overflow-hidden shadow-2xl lg:shadow-none ${
  mobileOpen
    ? "translate-x-0"
    : "-translate-x-full lg:translate-x-0"
}`}
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-bearing-600/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 -left-16 w-48 h-48 rounded-full bg-brass-500/10 blur-3xl pointer-events-none"></div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0 relative">
          <Logo variant="light" />
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-navy-100/60 hover:bg-white/8 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto scrollbar-none relative">
          {items.map(([key, label, Icon]) => {
            const isUpgradeCta = key === "billing" && !isPremium;
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => { onNav(key); setMobileOpen(false); }}
                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "bg-gradient-to-r from-bearing-600 to-bearing-500 text-white shadow-lg shadow-bearing-600/30"
                    : isUpgradeCta
                    ? "text-brass-400 hover:bg-white/5 hover:text-brass-300"
                    : "text-navy-100/60 hover:bg-white/8 hover:text-white hover:translate-x-0.5"}`}
              >
                <Icon className={`w-[18px] h-[18px] transition-transform ${isActive ? "" : "group-hover:scale-110"}`} strokeWidth={1.8} /> {label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1 relative">
          <button
            onClick={() => { onNav("settings"); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${active === "settings" ? "bg-gradient-to-r from-bearing-600 to-bearing-500 text-white shadow-lg shadow-bearing-600/30" : "text-navy-100/60 hover:bg-white/8 hover:text-white hover:translate-x-0.5"}`}
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={1.8} /> Settings
          </button>
          <button onClick={() => setConfirmLogout(true)} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-navy-100/60 hover:bg-white/8 hover:text-red-300 transition-all duration-200 hover:translate-x-0.5">
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} /> Log out
          </button>
        </div>
      </aside>
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <div className="w-11 h-11 rounded-2xl bg-red-50 ring-1 ring-red-200 flex items-center justify-center shrink-0"><LogOut className="w-5 h-5 text-red-600" /></div>
            <button onClick={() => setConfirmLogout(false)} className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg hover:bg-navy-50 text-ink-500"><X className="w-4 h-4" /></button>
          </div>
          <p className="font-display font-semibold text-navy-900 mt-3">Log out of RightTrack?</p>
          <p className="text-sm text-ink-500 mt-1.5">You'll need to log back in to access your dashboard.</p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setConfirmLogout(false)} className="btn-ghost flex-1">Stay Logged In</button>
            <button
              onClick={() => { setConfirmLogout(false); onExit(); }}
              className="flex-1 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition px-4 py-2.5"
            >
              Log Out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

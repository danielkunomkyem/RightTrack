import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import NotifPanel from "./components/NotifPanel.jsx";
import { Toast } from "./components/UI.jsx";
import Landing from "./pages/Landing.jsx";
import Developers from "./pages/Developers.jsx";
import Faq from "./pages/Faq.jsx";
import Blog from "./pages/Blog.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import { SignUp, Login, VerifyEmail, AdjusterApplicationStatus, SuperAdminLogin, ForgotPassword } from "./pages/Auth.jsx";
import ApplicantDashboard from "./pages/applicant/Dashboard.jsx";
import NewClaimWizard from "./pages/applicant/NewClaim.jsx";
import MyClaims from "./pages/applicant/MyClaims.jsx";
import ClaimDetailApplicant from "./pages/applicant/ClaimDetail.jsx";
import MyPolicies from "./pages/applicant/MyPolicies.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import ClaimsQueue from "./pages/admin/Queue.jsx";
import ClaimReview from "./pages/admin/ClaimReview.jsx";
import ManagePolicies from "./pages/admin/Policies.jsx";
import Billing from "./pages/admin/Billing.jsx";
import SuperAdminDashboard from "./pages/superadmin/Dashboard.jsx";
import SuperAdminClaims from "./pages/superadmin/Claims.jsx";
import SuperAdminAdjusters from "./pages/superadmin/Adjusters.jsx";
import SuperAdminPolicyholders from "./pages/superadmin/Policyholders.jsx";
import ApiDocs from "./pages/ApiDocs.jsx";
import Settings from "./pages/Settings.jsx";
import { seedClaims, seedAdjusters, seedPolicyholders } from "./lib/data.js";
import { NOW, fmtMoney, uid } from "./lib/helpers.js";
import { PREMIUM_PRICE, PREMIUM_TRIAL_DAYS } from "./lib/constants.js";
import { SiteNavContext } from "./lib/SiteNav.jsx";
import { SCREEN_PATHS, appPath, resolveRoute, roleHomePath } from "./lib/routes.js";
import { loginRequest, verifyOtpRequest, resendOtpRequest, signupRequest, verifySignupOtpRequest, resendSignupOtpRequest, meRequest, googleAuthRequest, listClaimsRequest, createClaimRequest, reuploadRequest, rateClaimRequest, startReviewRequest, requestInfoRequest, decideClaimRequest, listMyPoliciesRequest } from "./lib/api.js";
import { initGoogleSignIn, promptGoogleSignIn } from "./lib/googleAuth.js";

function savedAdjusterApplication() {
  try {
    return JSON.parse(sessionStorage.getItem("rt_adjuster_application")) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = resolveRoute(location.pathname);
  const screen = route.screen;
  const view = route.view || "dashboard";
  const selected = route.claimId || null;
  const [scrollTarget, setScrollTarget] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(() => sessionStorage.getItem("rt_pending_email") || "");
  const [pendingRole, setPendingRole] = useState(() => sessionStorage.getItem("rt_pending_role") || "applicant");
  const [pendingRemember, setPendingRemember] = useState(() => sessionStorage.getItem("rt_pending_remember") === "true");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [otpResendStatus, setOtpResendStatus] = useState("");
  const [adjusterApplication, setAdjusterApplication] = useState(savedAdjusterApplication);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [role, setRole] = useState("applicant");
  const [plan, setPlan] = useState("free");
  const [claims, setClaims] = useState(seedClaims);
  const [myPolicies, setMyPolicies] = useState([]);
  const [adjusters, setAdjusters] = useState(seedAdjusters);
  const [policyholders, setPolicyholders] = useState(seedPolicyholders);
  const [toasts, setToasts] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState({ avatarUrl: null, fullName: "", email: "", phone: "", policyId: "", plan: "", orgName: "", licenseNumber: "", notifyEmail: true, notifySms: false });
  const updateProfile = (patch) => setProfile((prev) => ({ ...prev, ...patch }));
  const setScreen = (next, options) => navigate(SCREEN_PATHS[next] || "/", options);
  const setView = (next) => navigate(appPath(role, next));

  useEffect(() => {
    if (pendingEmail) sessionStorage.setItem("rt_pending_email", pendingEmail);
    else sessionStorage.removeItem("rt_pending_email");
  }, [pendingEmail]);

  useEffect(() => {
    sessionStorage.setItem("rt_pending_role", pendingRole);
  }, [pendingRole]);

  useEffect(() => {
    sessionStorage.setItem("rt_pending_remember", String(pendingRemember));
  }, [pendingRemember]);

  useEffect(() => {
    if (adjusterApplication) sessionStorage.setItem("rt_adjuster_application", JSON.stringify(adjusterApplication));
    else sessionStorage.removeItem("rt_adjuster_application");
  }, [adjusterApplication]);

  useEffect(() => {
    if (screen === "landing" && scrollTarget) return;
    window.scrollTo(0, 0);
  }, [location.pathname, screen, scrollTarget]);

  // Load real claims from the backend once the person is inside the app.
  useEffect(() => {
    if (screen !== "app") return;
    listClaimsRequest()
      .then(({ claims }) => setClaims(claims))
      .catch((err) => pushToast({ type: "warn", title: "Couldn't load claims", body: err.message }));
  }, [screen]);

  // Policyholders: load the policy numbers assigned to them, so a fresh
  // assignment shows up as a real notification, not just an email.
  useEffect(() => {
    if (screen !== "app" || role !== "applicant") return;
    listMyPoliciesRequest()
      .then(({ policies }) => {
        setMyPolicies(policies);
        // Auto-fill the Settings page's "Policy Number" with their first
        // active policy, since it's no longer collected at signup.
        if (policies.length > 0) {
          setProfile((prev) => ({ ...prev, policyId: prev.policyId || policies[0].policyId }));
        }
      })
      .catch(() => { /* non-critical — silently skip if it fails */ });
  }, [screen, role]);

  const pushToast = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  };

  const enterApp = (r = "applicant", identity = null) => {
    setRole(r);
    setAdjusterApplication(null);
    if (identity) {
      setProfile((prev) => ({
        ...prev,
        fullName: identity.fullName || (r === "superadmin" ? "System Administrator" : ""),
        email: identity.email || "",
        policyId: identity.policyNumber || "",
        orgName: identity.orgName || "",
        licenseNumber: identity.licenseNumber || "",
      }));
    }
    if (screen !== "app" || route.requiredRole !== r) {
      navigate(roleHomePath(r), { replace: true });
    }
  };
  const exitApp = () => {
    localStorage.removeItem("rt_token");
    setPendingEmail("");
    navigate("/", { replace: true });
  };

  // On page load, try to restore a session from a token saved in localStorage.
  // This is what makes "Remember me" actually stick across refreshes.
  useEffect(() => {
    const token = localStorage.getItem("rt_token");
    if (!token) {
      setSessionChecked(true);
      return;
    }
    meRequest(token)
      .then((res) => {
        enterApp(res.user.role, res.user);
      })
      .catch(() => {
        localStorage.removeItem("rt_token");
      })
      .finally(() => setSessionChecked(true));
  }, []);

  // Set up Google Identity Services once. The callback fires whenever the
  // person completes the Google popup, from whichever button triggered it.
  const pendingGoogleRoleRef = useRef("applicant");
  useEffect(() => {
    initGoogleSignIn(async (credential) => {
      setAuthLoading(true);
      try {
        const res = await googleAuthRequest(credential, pendingGoogleRoleRef.current, false);
        localStorage.setItem("rt_token", res.token);
        enterApp(res.user.role, res.user);
        pushToast({ type: "success", title: "Signed in with Google", body: `Welcome, ${res.user.fullName || res.user.email}.` });
      } catch (err) {
        pushToast({ type: "warn", title: "Google sign-in failed", body: err.message });
      } finally {
        setAuthLoading(false);
      }
    });
  }, []);

  const openClaim = (id) => navigate(appPath(role, "detail", id));

  const addClaim = async (claimObj, refToOpen) => {
    if (claimObj) {
      try {
        const { claim } = await createClaimRequest({
          fullName: claimObj.fullName,
          policyId: claimObj.policyId,
          amount: claimObj.amount,
          description: claimObj.description,
          documents: claimObj.documents,
        });
        setClaims((prev) => [claim, ...prev]);
        pushToast({ type: "success", title: "Claim submitted", body: `Reference ${claim.id} created.` });
        return claim.id;
      } catch (err) {
        pushToast({ type: "warn", title: "Submission failed", body: err.message });
        return null;
      }
    }
    if (refToOpen) openClaim(refToOpen);
  };

  const reupload = async (id, files) => {
    try {
      const { claim } = await reuploadRequest(id, files);
      setClaims((prev) => prev.map((c) => (c.id === id ? claim : c)));
      pushToast({ type: "success", title: "Document submitted", body: "Your claim is back under review." });
    } catch (err) {
      pushToast({ type: "warn", title: "Couldn't submit document", body: err.message });
    }
  };

  const rate = async (id, r) => {
    try {
      const { claim } = await rateClaimRequest(id, r.stars, r.review);
      setClaims((prev) => prev.map((c) => (c.id === id ? claim : c)));
      pushToast({ type: "success", title: "Thanks for your feedback!" });
    } catch (err) {
      pushToast({ type: "warn", title: "Couldn't submit rating", body: err.message });
    }
  };

  const startReview = async (id) => {
    try {
      const { claim } = await startReviewRequest(id);
      setClaims((prev) => prev.map((c) => (c.id === id ? claim : c)));
      pushToast({ type: "success", title: `${id} moved to Under Review`, body: `Assigned to ${claim.adjuster}.` });
    } catch (err) {
      pushToast({ type: "warn", title: "Couldn't start review", body: err.message });
    }
  };

  const decide = async (id, status, { rejectionCode, notes } = {}) => {
    try {
      const { claim } = await decideClaimRequest(id, status, rejectionCode, notes);
      setClaims((prev) => prev.map((c) => (c.id === id ? claim : c)));
      pushToast({ type: status === "approved" ? "success" : "warn", title: `${id} marked ${status}`, body: "Applicant view updated in real time." });
    } catch (err) {
      pushToast({ type: "warn", title: "Couldn't record decision", body: err.message });
    }
  };

  const startTrial = () => {
    setPlan("trial");
    pushToast({ type: "success", title: "Free trial started", body: `Your ${PREMIUM_TRIAL_DAYS}-day free trial is active. API keys and CSV export are now unlocked — cancel anytime.` });
  };
  const upgradePlan = (cycle) => {
    setPlan("premium");
    pushToast({ type: "success", title: "Subscription active", body: `Billed ${fmtMoney(PREMIUM_PRICE[cycle])} / ${cycle === "annual" ? "year" : "month"}. API keys and CSV export are now unlocked.` });
  };
  const downgradePlan = () => {
    const wasTrial = plan === "trial";
    setPlan("free");
    pushToast({ type: "warn", title: wasTrial ? "Trial canceled" : "Subscription canceled", body: "You're back on the free plan — subscriber-only features are now locked." });
  };

  const toggleAdjusterStatus = (id) => {
    setAdjusters((prev) => prev.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "suspended" : "active" } : a));
    const a = adjusters.find((x) => x.id === id);
    if (a) pushToast({ type: a.status === "active" ? "warn" : "success", title: `${a.name} ${a.status === "active" ? "suspended" : "reactivated"}`, body: a.status === "active" ? "Their queue access has been revoked." : "Queue access has been restored." });
  };

  const togglePolicyholderStatus = (id) => {
    setPolicyholders((prev) => prev.map((p) => p.id === id ? { ...p, status: p.status === "active" ? "inactive" : "active" } : p));
    const p = policyholders.find((x) => x.id === id);
    if (p) pushToast({ type: p.status === "active" ? "warn" : "success", title: `${p.name} ${p.status === "active" ? "suspended" : "reactivated"}` });
  };

  const addAdjuster = (form) => {
    setAdjusters((prev) => [...prev, { id: uid("ADJ"), status: "active", joinedAt: NOW.toISOString().slice(0, 10), ...form }]);
  };

  const requestInfo = async (id, notes) => {
    try {
      const { claim } = await requestInfoRequest(id, notes);
      setClaims((prev) => prev.map((c) => (c.id === id ? claim : c)));
      pushToast({ type: "warn", title: `${id} flagged`, body: "Applicant has been notified to provide more info." });
    } catch (err) {
      pushToast({ type: "warn", title: "Couldn't flag claim", body: err.message });
    }
  };

  const navAnchor = (id) => {
    if (screen === "landing") {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setScrollTarget(id);
      navigate("/");
    }
  };

  const siteNav = {
    onNavAnchor: navAnchor,
    onDevelopers: () => navigate("/developers"),
    onGetStarted: () => navigate("/signup"),
    onLogin: () => navigate("/login"),
    onHome: () => { setScrollTarget(null); navigate("/"); },
    onFaq: () => navigate("/faq"),
    onBlog: () => navigate("/blog"),
    onPrivacy: () => navigate("/privacy"),
    onTerms: () => navigate("/terms"),
  };
  const goSignupAsAdjuster = () => navigate("/signup/adjuster");

  if (!sessionChecked) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-bearing-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <Toast toasts={toasts} />
      </>
    );
  }

  if (screen === "not-found") {
    return <Navigate to={localStorage.getItem("rt_token") ? roleHomePath(role) : "/"} replace />;
  }

  if (screen === "app" && !localStorage.getItem("rt_token")) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (screen === "app" && route.requiredRole !== role) {
    return <Navigate to={roleHomePath(role)} replace />;
  }

  if ((screen === "signup-verify" || screen === "login-verify") && !pendingEmail) {
    return <Navigate to={screen === "signup-verify" ? "/login" : pendingRole === "superadmin" ? "/super-admin/login" : "/login"} replace />;
  }

  if (screen === "adjuster-status" && !adjusterApplication) {
    return <Navigate to="/login" replace />;
  }

  if (screen === "landing") {
    return (
      <>
        <SiteNavContext.Provider value={siteNav}>
          <Landing onGetStarted={siteNav.onGetStarted} onGetStartedAdjuster={goSignupAsAdjuster} onLogin={siteNav.onLogin} scrollTarget={scrollTarget} onScrolled={() => setScrollTarget(null)} />
        </SiteNavContext.Provider>
        <Toast toasts={toasts} />
      </>
    );
  }
  if (screen === "developers") {
    return <><SiteNavContext.Provider value={siteNav}><Developers /></SiteNavContext.Provider><Toast toasts={toasts} /></>;
  }
  if (screen === "faq") {
    return <><SiteNavContext.Provider value={siteNav}><Faq /></SiteNavContext.Provider><Toast toasts={toasts} /></>;
  }
  if (screen === "blog") {
    return <><SiteNavContext.Provider value={siteNav}><Blog /></SiteNavContext.Provider><Toast toasts={toasts} /></>;
  }
  if (screen === "privacy") {
    return <><SiteNavContext.Provider value={siteNav}><Privacy /></SiteNavContext.Provider><Toast toasts={toasts} /></>;
  }
  if (screen === "terms") {
    return <><SiteNavContext.Provider value={siteNav}><Terms /></SiteNavContext.Provider><Toast toasts={toasts} /></>;
  }
  const handleGoogleAuth = (mode, role) => {
    pendingGoogleRoleRef.current = role || "applicant";
    const opened = promptGoogleSignIn();
    if (!opened) {
      pushToast({ type: "warn", title: "Google sign-in unavailable", body: "Please check your internet connection and try again." });
    }
  };

  if (screen === "signup") {
    return (
      <>
      <SignUp
        initialRole={route.signupRole || "applicant"}
        onRoleChange={(nextRole) => navigate(nextRole === "admin" ? "/signup/adjuster" : "/signup", { replace: true })}
        onGoLogin={() => setScreen("login")}
        onTerms={() => setScreen("terms")}
        onPrivacy={() => setScreen("privacy")}
        onSubmit={async (form) => {
          setAuthLoading(true);
          setAuthError("");
          try {
            const res = await signupRequest(form);
            pushToast({
              type: "success",
              title: form.role === "admin" ? "Verification submitted" : "Account created",
              body: res.message,
            });
            setPendingEmail(res.user.email);
            setPendingRole(form.role);
            setPendingRemember(false);
            setOtpResendStatus(res.verificationEmailSent === false ? "Request a new code to retry email delivery." : "");
            setScreen("signup-verify");
          } catch (err) {
            pushToast({ type: "warn", title: "Sign up failed", body: err.message });
          } finally {
            setAuthLoading(false);
          }
        }}
        loading={authLoading}
      />
      <Toast toasts={toasts} />
      </>
    );
  }
  if (screen === "signup-verify") {
    return (
      <>
      <VerifyEmail
        email={pendingEmail}
        title={pendingRole === "admin" ? "Verify adjuster account" : "Verify policyholder account"}
        description={pendingRole === "admin" ? "Enter the sign-up code sent to your work email before your application can be reviewed." : "Enter the sign-up code to confirm that you own this email address."}
        onBack={() => { setAuthError(""); setScreen("login"); }}
        loading={authLoading}
        error={authError}
        resendStatus={otpResendStatus}
        onVerified={async (otp) => {
          setAuthLoading(true);
          setAuthError("");
          try {
            const res = await verifySignupOtpRequest(pendingEmail, otp, pendingRemember);
            setPendingEmail("");
            if (res.user.role === "admin") {
              setAdjusterApplication(res.application);
              pushToast({ type: "success", title: "Work email verified", body: res.message });
              setScreen("adjuster-status");
            } else {
              localStorage.setItem("rt_token", res.token);
              pushToast({ type: "success", title: "Email verified", body: "Your policyholder account is now active." });
              enterApp(res.user.role, res.user);
            }
          } catch (err) {
            setAuthError(err.message);
          } finally {
            setAuthLoading(false);
          }
        }}
        onResend={async () => {
          setOtpResendStatus("Sending…");
          setAuthError("");
          try {
            await resendSignupOtpRequest(pendingEmail);
            setOtpResendStatus("A new account verification code has been sent.");
          } catch (err) {
            setOtpResendStatus(err.message);
          }
        }}
      />
      <Toast toasts={toasts} />
      </>
    );
  }
  if (screen === "login") {
    return (
      <>
      <Login
        onGoSignup={() => setScreen("signup")}
        onSubmit={async (form) => {
          setAuthLoading(true);
          setAuthError("");
          try {
            await loginRequest(form.email, form.password, form.role);
            setPendingEmail(form.email);
            setPendingRole(form.role);
            setPendingRemember(form.remember);
            setOtpResendStatus("");
            setScreen("login-verify");
          } catch (err) {
            if (err.code === "EMAIL_NOT_VERIFIED") {
              setPendingEmail(err.email || form.email);
              setPendingRole(err.role || form.role);
              setPendingRemember(form.remember);
              setOtpResendStatus("Your account still needs email verification. Request a new code if the original OTP has expired.");
              setAuthError("");
              setScreen("signup-verify");
            } else if (err.code === "ACCOUNT_PENDING" && err.application) {
              setPendingEmail("");
              setPendingRole("admin");
              setAdjusterApplication(err.application);
              setAuthError("");
              setScreen("adjuster-status");
            } else {
              setAuthError(err.message);
            }
          } finally {
            setAuthLoading(false);
          }
        }}
        onGoSuperAdmin={() => setScreen("superadmin-login")}
        onForgotPassword={() => setScreen("forgot-password")}
        onGoogleAuth={handleGoogleAuth}
        loading={authLoading}
        error={authError}
      />
      <Toast toasts={toasts} />
      </>
    );
  }
  if (screen === "adjuster-status") {
    return <><AdjusterApplicationStatus application={adjusterApplication} onLogin={() => { setAuthError(""); setScreen("login"); }} /><Toast toasts={toasts} /></>;
  }
  if (screen === "login-verify") {
    return (
      <>
      <VerifyEmail
        email={pendingEmail}
        onBack={() => { setAuthError(""); setScreen(pendingRole === "superadmin" ? "superadmin-login" : "login"); }}
        loading={authLoading}
        error={authError}
        resendStatus={otpResendStatus}
        onVerified={async (otp) => {
          setAuthLoading(true);
          setAuthError("");
          try {
            const res = await verifyOtpRequest(pendingEmail, otp, pendingRemember);
            localStorage.setItem("rt_token", res.token);
            setPendingEmail("");
            enterApp(res.user.role, res.user);
          } catch (err) {
            if (err.code === "ACCOUNT_PENDING" && err.application) {
              setPendingEmail("");
              setPendingRole("admin");
              setAdjusterApplication(err.application);
              setAuthError("");
              setScreen("adjuster-status");
            } else {
              setAuthError(err.message);
            }
          } finally {
            setAuthLoading(false);
          }
        }}
        onResend={async () => {
          setOtpResendStatus("Sending…");
          try {
            await resendOtpRequest(pendingEmail);
            setOtpResendStatus("A new code has been sent.");
          } catch (err) {
            setOtpResendStatus(err.message);
          }
        }}
      />
      <Toast toasts={toasts} />
      </>
    );
  }
  if (screen === "forgot-password") {
    return <><ForgotPassword onBack={() => setScreen("login")} onDone={() => setScreen("login")} /><Toast toasts={toasts} /></>;
  }
  if (screen === "superadmin-login") {
    return <>
      <SuperAdminLogin
        onBack={() => { setAuthError(""); setScreen("login"); }}
        loading={authLoading}
        error={authError}
        onSubmit={async (form) => {
          setAuthLoading(true);
          setAuthError("");
          try {
            await loginRequest(form.email, form.password, "superadmin");
            setPendingEmail(form.email);
            setPendingRole("superadmin");
            setPendingRemember(false);
            setOtpResendStatus("");
            setScreen("login-verify");
          } catch (err) {
            setAuthError(err.message);
          } finally {
            setAuthLoading(false);
          }
        }}
      />
      <Toast toasts={toasts} />
    </>;
  }

  const selectedClaim = claims.find((c) => c.id === selected);
  const adjusterClaims = claims.filter((c) => c.insurer === profile.orgName);
  const isOwnClaim = !selectedClaim || selectedClaim.insurer === profile.orgName;
  const notifClaims = role === "admin" ? adjusterClaims : claims;
  const notifCount = notifClaims.filter((c) => c.status === "action_required").length + (role === "applicant" ? myPolicies.length : 0);

  let title = "Dashboard", subtitle = "";
  if (view === "new") title = "New Claim";
  if (view === "claims") title = "My Claims";
  if (view === "queue") title = "Claims Queue";
  if (view === "policies") title = role === "admin" ? "Manage Policies" : "My Policies";
  if (view === "api") title = "Developer / API";
  if (view === "billing") title = "Plans & Billing";
  if (view === "sa-dashboard") title = "Super Admin Overview";
  if (view === "sa-claims") title = "All Claims";
  if (view === "sa-adjusters") title = "Adjusters";
  if (view === "sa-policyholders") title = "Policyholders";
  if (view === "settings") title = "Settings";
  if (view === "detail" && selectedClaim) { title = selectedClaim.id; subtitle = selectedClaim.category; }

  return (
    <div className="min-h-screen flex bg-[#f5f6fa]">
      <Sidebar role={role} plan={plan} active={view} onNav={setView} onExit={exitApp} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 w-full min-w-0 flex flex-col">
        <Topbar title={title} subtitle={subtitle} role={role} plan={plan} onMenu={() => setMobileOpen(true)} notifCount={notifCount} onBell={() => setNotifOpen((o) => !o)} onSettings={() => setView("settings")} avatarUrl={profile.avatarUrl} profile={profile} />
        <main className="flex-1 p-4 sm:p-8">
          {role === "applicant" && view === "dashboard" && <ApplicantDashboard claims={claims} onNav={setView} onOpenClaim={openClaim} profile={profile} />}
          {role === "applicant" && view === "new" && <NewClaimWizard claims={claims} onSubmitClaim={addClaim} pushToast={pushToast} />}
          {role === "applicant" && view === "claims" && <MyClaims claims={claims} onOpenClaim={openClaim} onNav={setView} />}
          {role === "applicant" && view === "policies" && <MyPolicies policies={myPolicies} />}
          {role === "applicant" && view === "detail" && selectedClaim && <ClaimDetailApplicant claim={selectedClaim} onBack={() => setView("claims")} onReupload={reupload} onRate={rate} pushToast={pushToast} />}
          {role === "admin" && view === "dashboard" && <AdminDashboard claims={adjusterClaims} onOpenClaim={openClaim} profile={profile} />}
          {role === "admin" && view === "queue" && <ClaimsQueue claims={adjusterClaims} onOpenClaim={openClaim} plan={plan} onGoBilling={() => setView("billing")} pushToast={pushToast} insurer={profile.orgName} />}
          {role === "admin" && view === "policies" && <ManagePolicies pushToast={pushToast} />}
          {role === "admin" && view === "detail" && selectedClaim && isOwnClaim && <ClaimReview claim={selectedClaim} onBack={() => setView("queue")} onStartReview={startReview} onDecision={decide} onRequestInfo={requestInfo} pushToast={pushToast} />}
          {role === "admin" && view === "billing" && <Billing plan={plan} onUpgrade={upgradePlan} onDowngrade={downgradePlan} onStartTrial={startTrial} />}
          {role === "superadmin" && view === "sa-dashboard" && <SuperAdminDashboard claims={claims} adjusters={adjusters} policyholders={policyholders} onOpenClaim={openClaim} onNav={setView} />}
          {role === "superadmin" && view === "sa-claims" && <SuperAdminClaims claims={claims} adjusters={adjusters} onOpenClaim={openClaim} />}
          {role === "superadmin" && view === "sa-adjusters" && <SuperAdminAdjusters adjusters={adjusters} claims={claims} onToggleStatus={toggleAdjusterStatus} onAddAdjuster={addAdjuster} pushToast={pushToast} />}
          {role === "superadmin" && view === "sa-policyholders" && <SuperAdminPolicyholders policyholders={policyholders} claims={claims} onToggleStatus={togglePolicyholderStatus} pushToast={pushToast} onOpenClaim={openClaim} />}
          {role === "superadmin" && view === "detail" && selectedClaim && <ClaimReview claim={selectedClaim} onBack={() => setView("sa-claims")} onDecision={decide} onRequestInfo={requestInfo} pushToast={pushToast} readOnly />}
          {view === "api" && <ApiDocs role={role} plan={plan} onGoBilling={() => setView("billing")} pushToast={pushToast} />}
          {view === "settings" && <Settings role={role} profile={profile} onUpdateProfile={updateProfile} pushToast={pushToast} />}
        </main>
      </div>
      <Toast toasts={toasts} />
      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} claims={notifClaims} policies={role === "applicant" ? myPolicies : []} />
    </div>
  );
}

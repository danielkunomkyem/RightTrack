import { useState, useRef } from "react";
import { Mail, Lock, ArrowLeft, User, Hash, Building2, BadgeCheck, ShieldCheck, UserRound, ShieldAlert, Check, Eye, EyeOff } from "lucide-react";
import Logo from "../components/Logo.jsx";
import { CATEGORY_META } from "../lib/constants.js";
import { forgotPasswordRequest, verifyResetOtpRequest, resetPasswordRequest } from "../lib/api.js";

function AuthShell({ children, wide }) {
  return (
    <div className="min-h-[100dvh] flex justify-center p-4 relative overflow-x-hidden bg-navy-950">
      <div className="absolute inset-0">
        <img src="/bg-compass.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/90 via-navy-950/90 to-navy-950/95" />
      </div>
      <div className={`relative self-start my-auto w-full ${wide ? "max-w-lg" : "max-w-md"} bg-white rounded-3xl shadow-pop p-6 sm:p-8 animate-fadein`}>{children}</div>
    </div>
  );
}

function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 border border-ink-900/12 rounded-xl py-2.5 text-sm font-semibold text-ink-700 hover:bg-navy-50/60 transition disabled:opacity-60 disabled:cursor-wait"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4">
        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.93.47 3.76 1.28 5.39l3.99-3.11Z" />
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
      </svg>
      {loading ? "Connecting to Google…" : "Continue with Google"}
    </button>
  );
}

function TextField({ label, icon: Icon, hint, type, ...inputProps }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700 mb-1.5 block">{label}</span>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />}
        <input
          type={inputType}
          {...inputProps}
          className={`input ${Icon ? "pl-9" : ""} ${isPassword ? "pr-9" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <span className="text-[11px] text-ink-400 mt-1 block">{hint}</span>}
    </label>
  );
}

const ROLE_OPTIONS = [
  {
    id: "applicant",
    label: "Policy Holder",
    icon: UserRound,
    blurb: "File and track your own claims",
  },
  {
    id: "admin",
    label: "Adjuster",
    icon: ShieldCheck,
    blurb: "Review and process claims for an organization",
  },
];

function RoleToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-6" role="radiogroup" aria-label="Account type">
      {ROLE_OPTIONS.map((r) => {
        const active = value === r.id;
        const Icon = r.icon;
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.id)}
            className={`text-left rounded-xl border p-3 transition ${
              active ? "border-bearing-600 bg-bearing-100/60 ring-1 ring-bearing-600" : "border-ink-900/12 hover:bg-navy-50/60"
            }`}
          >
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${active ? "text-navy-900" : "text-ink-700"}`}>
              <Icon className="w-4 h-4" />{r.label}
            </span>
            <span className="block text-[11px] text-ink-500 mt-1 leading-snug">{r.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

const emptyPolicyHolder = { fullName: "", email: "", password: "", confirm: "" };
const emptyAdjuster = { fullName: "", orgName: "", cac: "", organizationLicenseNumber: "", licenseNumber: "", claimCategories: [], email: "", password: "", confirm: "" };

// Loose format checks — these catch typos/nonsense input, not fraud.
// e.g. "ADJ-2451", "NAICOM-ADJ-00214", "LIC12345"
const LICENSE_PATTERN = /^[A-Za-z]{2,}[-\s]?[A-Za-z0-9-]{3,}$/;
// Nigerian CAC format: RC / BN / IT followed by 5-7 digits, e.g. "RC 1234567"
const CAC_PATTERN = /^(RC|BN|IT)\s?\d{5,7}$/i;
const ORGANIZATION_LICENSE_PATTERN = /^[A-Za-z]{2,}(?:[-/\s]?[A-Za-z0-9]+){1,}$/;

export function SignUp({ onSubmit, onGoLogin, onTerms, onPrivacy, onRoleChange, initialRole = "applicant", loading }) {
  const [role, setRole] = useState(initialRole);
  const [policyHolder, setPolicyHolder] = useState(emptyPolicyHolder);
  const [adjuster, setAdjuster] = useState(emptyAdjuster);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = role === "applicant" ? policyHolder : adjuster;
  const setForm = role === "applicant" ? setPolicyHolder : setAdjuster;

  // Collect every validation problem as a plain-English message, so the
  // button is never just silently disabled — the person always sees why.
  const errors = [];
  if (form.fullName.trim().length <= 1) errors.push("Enter your full name.");
  if (!form.email.includes("@")) errors.push("Enter a valid email address.");
  if (form.password.length < 8) errors.push("Password must be at least 8 characters.");
  if (form.password !== form.confirm) errors.push("Password and Confirm Password don't match.");
  if (!acceptedTerms) errors.push("Accept the Terms of Service and Privacy Policy.");
  if (role === "admin") {
    if (!adjuster.orgName.trim()) errors.push("Enter your organization's name.");
    if (!adjuster.licenseNumber.trim()) {
      errors.push("Enter your Adjuster License / Staff ID.");
    } else if (!LICENSE_PATTERN.test(adjuster.licenseNumber.trim())) {
      errors.push("Adjuster License / Staff ID doesn't look right — expected letters and numbers, e.g. NAICOM-ADJ-00214.");
    }
    if (!adjuster.cac.trim()) {
      errors.push("Enter your CAC Registration Number.");
    } else if (!CAC_PATTERN.test(adjuster.cac.trim())) {
      errors.push("CAC Registration Number doesn't look right — expected format like RC 1234567.");
    }
    if (!adjuster.organizationLicenseNumber.trim()) {
      errors.push("Enter the organization's regulatory licence number.");
    } else if (!ORGANIZATION_LICENSE_PATTERN.test(adjuster.organizationLicenseNumber.trim())) {
      errors.push("Organization licence number doesn't look right — expected letters and numbers.");
    }
    if (adjuster.claimCategories.length === 0) {
      errors.push("Select at least one claim category your organization handles.");
    }
  }
  const canSubmit = errors.length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;
    onSubmit({ role, acceptedTerms, ...form });
  };

  return (
    <AuthShell wide>
      <div className="flex justify-center mb-6"><Logo size="lg" /></div>
      <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Sign up</h1>
      <p className="text-sm text-ink-500 text-center mt-1">Tell us which kind of account you need</p>

      <div className="mt-6">
        <RoleToggle
          value={role}
          onChange={(nextRole) => {
            setRole(nextRole);
            onRoleChange?.(nextRole);
          }}
        />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextField
          label="Full Name"
          icon={User}
          type="text"
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="Enter your full name"
        />

        {role === "applicant" ? null : (
          <>
            <TextField
              label="Organization Name"
              icon={Building2}
              type="text"
              required
              value={adjuster.orgName}
              onChange={(e) => setAdjuster({ ...adjuster, orgName: e.target.value })}
              placeholder="e.g. Anchorline Insurance"
              hint="Your organization's name — this is what policyholders will search for."
            />
            <TextField
              label="Adjuster License / Staff ID"
              icon={BadgeCheck}
              type="text"
              required
              value={adjuster.licenseNumber}
              onChange={(e) => setAdjuster({ ...adjuster, licenseNumber: e.target.value })}
              placeholder="e.g. NAICOM-ADJ-00214"
            />
            <TextField
              label="CAC Registration Number"
              icon={Hash}
              type="text"
              required
              value={adjuster.cac}
              onChange={(e) => setAdjuster({ ...adjuster, cac: e.target.value })}
              placeholder="e.g. RC 1234567"
              hint="Used to verify the legal organization record."
            />
            <TextField
              label="Organization Regulatory Licence"
              icon={ShieldCheck}
              type="text"
              required
              value={adjuster.organizationLicenseNumber}
              onChange={(e) => setAdjuster({ ...adjuster, organizationLicenseNumber: e.target.value })}
              placeholder="e.g. NAICOM/INS/0123"
              hint="The insurer's regulator-issued licence number, not your staff ID."
            />
            <div>
              <span className="text-xs font-semibold text-ink-700 mb-1.5 block">Claim Categories You Handle</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(CATEGORY_META).map((cat) => {
                  const checked = adjuster.claimCategories.includes(cat);
                  return (
                    <label key={cat} className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-2.5 cursor-pointer ${checked ? "border-bearing-600 bg-bearing-100/50 text-navy-900" : "border-ink-900/12 text-ink-700"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...adjuster.claimCategories, cat]
                            : adjuster.claimCategories.filter((c) => c !== cat);
                          setAdjuster({ ...adjuster, claimCategories: next });
                        }}
                        className="rounded border-ink-900/20 shrink-0"
                      />
                      <span className="leading-snug break-words min-w-0">{cat}</span>
                    </label>
                  );
                })}
              </div>
              <span className="text-[11px] text-ink-400 mt-1.5 block">Policyholders will only see your organization for the categories you select here.</span>
            </div>
            <p className="text-[11px] text-ink-400 -mt-1">
              Verification happens in order: the organization registration is checked first, then your staff credentials. You cannot log in until both are approved.
            </p>
          </>
        )}

        <TextField
          label="Email Address"
          icon={Mail}
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Enter your email address"
          hint={role === "applicant" ? "We'll send a 6-digit OTP here to activate your policyholder account." : "Use your work email for organization verification."}
        />
        <TextField
          label="Password"
          icon={Lock}
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Enter your password"
        />
        <TextField
          label="Confirm Password"
          icon={Lock}
          type="password"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          placeholder="Confirm password"
        />

        <div className="flex items-start gap-2 text-sm text-ink-700">
          <input
            id="signup-consent"
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="rounded border-ink-900/20 mt-0.5"
          />
          <label htmlFor="signup-consent" className="leading-snug">
            I agree to the{" "}
            <button type="button" onClick={onTerms} className="font-semibold text-bearing-600 hover:underline">Terms of Service</button>
            {" "}and{" "}
            <button type="button" onClick={onPrivacy} className="font-semibold text-bearing-600 hover:underline">Privacy Policy</button>.
          </label>
        </div>

        {submitted && errors.length > 0 && (
          <div className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2 space-y-1">
            {errors.map((err) => <p key={err}>{err}</p>)}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? "Creating account…" : `Sign up as ${role === "applicant" ? "Policy Holder" : "Adjuster"}`}
        </button>
      </form>
      <p className="text-sm text-ink-500 text-center mt-6">
        Already have an account? <button onClick={onGoLogin} className="font-semibold text-bearing-600 hover:underline">Log in</button>
      </p>
    </AuthShell>
  );
}

export function Login({ onSubmit, onGoSignup, onGoSuperAdmin, onForgotPassword, onGoogleAuth, loading, error }) {
  const [role, setRole] = useState("applicant");
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const canSubmit = form.email.includes("@") && form.password.length > 0 && !loading;

  const handleGoogleClick = () => {
    setGoogleLoading(true);
    setTimeout(() => { setGoogleLoading(false); onGoogleAuth?.("login", role); }, 900);
  };

  return (
    <AuthShell>
      <div className="flex justify-center mb-6"><Logo size="lg" /></div>
      <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Log in</h1>
      <p className="text-sm text-ink-500 text-center mt-1">Log into your account</p>

      <div className="mt-6">
        <RoleToggle value={role} onChange={setRole} />
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit({ role, remember, ...form }); }}>
        <TextField
          label="Email Address"
          icon={Mail}
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Enter your email address"
        />
        <TextField
          label="Password"
          icon={Lock}
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Enter your password"
        />
        <div className="flex items-center justify-between -mt-2">
          <label className="flex items-center gap-2 text-xs text-ink-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-ink-900/20" />
            Remember me
          </label>
          <button type="button" onClick={onForgotPassword} className="text-xs font-semibold text-bearing-600 hover:underline">Forgotten password?</button>
        </div>
        {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={!canSubmit} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? "Checking…" : `Log in as ${role === "applicant" ? "Policy Holder" : "Adjuster"}`}
        </button>
        {role === "applicant" && (
          <>
            <div className="flex items-center gap-3 text-xs text-ink-300"><div className="h-px bg-ink-900/10 flex-1" />OR<div className="h-px bg-ink-900/10 flex-1" /></div>
            <GoogleButton onClick={handleGoogleClick} loading={googleLoading} />
          </>
        )}
      </form>
      <p className="text-sm text-ink-500 text-center mt-6">
        New to RightTrack? <button onClick={onGoSignup} className="font-semibold text-bearing-600 hover:underline">Sign up</button>
      </p>
      {onGoSuperAdmin && (
        <p className="text-xs text-ink-300 text-center mt-3">
          <button onClick={onGoSuperAdmin} className="inline-flex items-center gap-1 font-semibold text-ink-500 hover:text-navy-900">
            <ShieldAlert className="w-3.5 h-3.5" />Super Admin login
          </button>
        </p>
      )}
    </AuthShell>
  );
}

export function ForgotPassword({ onBack, onDone }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef([]);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("");

  const otpComplete = digits.every((d) => d !== "");
  const passwordsOk = pw.password.length >= 8 && pw.password === pw.confirm;

  const updateDigit = (i, val) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };
  const onDigitKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!email.includes("@") || loading) return;
    setLoading(true);
    setError("");
    try {
      await forgotPasswordRequest(email);
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpStep = async () => {
    if (!otpComplete || loading) return;
    setLoading(true);
    setError("");
    try {
      await verifyResetOtpRequest(email, digits.join(""));
      setStep("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setResendStatus("Sending…");
    try {
      await forgotPasswordRequest(email);
      setResendStatus("A new code has been sent.");
    } catch (err) {
      setResendStatus(err.message);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    if (!passwordsOk || loading) return;
    setLoading(true);
    setError("");
    try {
      await resetPasswordRequest(email, digits.join(""), pw.password);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {step === "email" && (
        <>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-navy-900 mb-4"><ArrowLeft className="w-4 h-4" />Back to log in</button>
          <div className="flex justify-center mb-6"><Logo size="lg" /></div>
          <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Forgot password</h1>
          <p className="text-sm text-ink-500 text-center mt-1">Enter the email on your account and we'll send you a one-time code to reset your password.</p>
          <form className="space-y-4 mt-6" onSubmit={sendOtp}>
            <TextField
              label="Email Address"
              icon={Mail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
            />
            {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={!email.includes("@") || loading} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <button onClick={() => { setError(""); setStep("email"); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-navy-900 mb-4"><ArrowLeft className="w-4 h-4" />Back</button>
          <div className="flex justify-center mb-6"><Logo size="lg" /></div>
          <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Enter the code</h1>
          <p className="text-sm text-ink-500 text-center mt-1">We've sent a 6-digit code to {email || "your email"}<br />It expires soon — check your inbox (and spam).</p>
          <div className="flex justify-center gap-2 mt-6">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                value={d}
                onChange={(e) => updateDigit(i, e.target.value)}
                onKeyDown={(e) => onDigitKeyDown(i, e)}
                maxLength={1}
                inputMode="numeric"
                className="w-11 h-12 text-center text-lg font-semibold rounded-xl border border-ink-900/12 focus:border-bearing-600 focus:ring-2 focus:ring-bearing-100 outline-none"
              />
            ))}
          </div>
          {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2 mt-4 text-center">{error}</p>}
          <button onClick={verifyOtpStep} disabled={!otpComplete || loading} className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? "Verifying…" : "Verify Code"}
          </button>
          <p className="text-sm text-ink-500 text-center mt-4">
            Didn't receive a code?{" "}
            <button type="button" onClick={resendOtp} className="font-semibold text-bearing-600 hover:underline">Request a new one</button>
            {resendStatus && <span className="block text-xs text-ink-400 mt-1">{resendStatus}</span>}
          </p>
        </>
      )}

      {step === "reset" && (
        <>
          <button onClick={() => { setError(""); setStep("otp"); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-navy-900 mb-4"><ArrowLeft className="w-4 h-4" />Back</button>
          <div className="flex justify-center mb-6"><Logo size="lg" /></div>
          <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Set a new password</h1>
          <p className="text-sm text-ink-500 text-center mt-1">Choose a new password for {email || "your account"}.</p>
          <form className="space-y-4 mt-6" onSubmit={submitNewPassword}>
            <TextField
              label="New Password"
              icon={Lock}
              type="password"
              required
              value={pw.password}
              onChange={(e) => setPw({ ...pw, password: e.target.value })}
              placeholder="Enter new password"
              hint="At least 8 characters."
            />
            <TextField
              label="Confirm Password"
              icon={Lock}
              type="password"
              required
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              placeholder="Confirm new password"
            />
            {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={!passwordsOk || loading} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        </>
      )}

      {step === "done" && (
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-emerald-600" /></div>
          <h1 className="font-display text-xl font-semibold text-navy-900">Password reset</h1>
          <p className="text-sm text-ink-500 mt-1">You can now log in with your new password.</p>
          <button onClick={onDone} className="btn-primary w-full mt-6">Back to Log in</button>
        </div>
      )}
    </AuthShell>
  );
}

export function SuperAdminLogin({ onSubmit, onBack, loading, error }) {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) onSubmit(form);
  };

  return (
    <AuthShell>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-navy-900 mb-4"><ArrowLeft className="w-4 h-4" />Back</button>
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 rounded-2xl bg-navy-900 flex items-center justify-center text-white"><ShieldAlert className="w-6 h-6" /></div>
      </div>
      <h1 className="font-display text-xl font-semibold text-navy-900 text-center">Super Admin</h1>
      <p className="text-sm text-ink-500 text-center mt-1">Restricted access — platform oversight console</p>

      <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
        <TextField
          label="Admin Email"
          icon={Mail}
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Enter the configured admin email"
        />
        <TextField
          label="Password"
          icon={Lock}
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Enter password"
        />
        {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? "Checking…" : "Continue to verification"}
        </button>
      </form>
      <p className="text-[11px] text-ink-300 text-center mt-6">This account manages the whole platform — policyholders, adjusters, and every claim in the system.</p>
    </AuthShell>
  );
}

export function VerifyEmail({ email, onVerified, onBack, onResend, loading, error, resendStatus, title = "Verify your login", description }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef([]);
  const complete = digits.every((d) => d !== "");

  const update = (i, val) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };
  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] || "");
    setDigits(next);
    refs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  const handleVerify = () => {
    if (!complete || loading) return;
    onVerified?.(digits.join(""));
  };

  return (
    <AuthShell>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-navy-900 mb-4"><ArrowLeft className="w-4 h-4" />Back</button>
      <div className="flex justify-center mb-6"><Logo size="lg" /></div>
      <h1 className="font-display text-xl font-semibold text-navy-900 text-center">{title}</h1>
      <p className="text-sm text-ink-500 text-center mt-1">
        {description || "Enter the code to finish signing in."}<br />
        We sent a 6-digit code to <span className="font-medium text-ink-700">{email || "your email"}</span>. It expires in 5 minutes.
      </p>
      <div className="flex justify-center gap-2 mt-6">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            maxLength={1}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`OTP digit ${i + 1}`}
            className="w-11 h-12 text-center text-lg font-semibold rounded-xl border border-ink-900/12 focus:border-bearing-600 focus:ring-2 focus:ring-bearing-100 outline-none"
          />
        ))}
      </div>
      {error && <p className="text-xs font-medium text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2 mt-4 text-center">{error}</p>}
      <button onClick={handleVerify} disabled={!complete || loading} className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed">
        {loading ? "Verifying…" : "Verify"}
      </button>
      <p className="text-sm text-ink-500 text-center mt-4">
        Didn't receive a code?{" "}
        <button type="button" disabled={loading} onClick={onResend} className="font-semibold text-bearing-600 hover:underline disabled:opacity-50">Request a new one</button>
        {resendStatus && <span className="block text-xs text-ink-400 mt-1">{resendStatus}</span>}
      </p>
    </AuthShell>
  );
}

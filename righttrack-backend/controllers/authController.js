const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { generateOtp, hashOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail, sendSignupVerificationEmail, sendPasswordResetEmail } = require("../utils/sendEmail");
const {
  normalizeOrganizationName,
  normalizeIdentifier,
  validateAdjusterApplication,
} = require("../utils/verification");

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    policyNumber: user.policyNumber || "",
    orgName: user.organization?.name || user.orgName || "",
    organizationId: user.organization?._id || user.organization || null,
    licenseNumber: user.licenseNumber || "",
    verificationStatus: user.verificationStatus,
  };
}

async function adjusterAccountState(user) {
  if (user.role !== "admin") return { blocked: false, application: null };

  const organization = user.organization
    ? await Organization.findById(user.organization).select("name status verificationNote")
    : null;
  const application = {
    email: user.email,
    fullName: user.fullName,
    emailVerified: Boolean(user.isVerified),
    organizationName: organization?.name || user.orgName || "",
    organizationStatus: organization?.status || "missing",
    adjusterStatus: user.verificationStatus,
    note: user.verificationNote || organization?.verificationNote || "",
  };

  if (!organization) {
    return { blocked: true, message: "Your adjuster account is not linked to a verified organization. Contact support.", application };
  }
  if (organization.status === "pending") {
    return { blocked: true, message: "Your organization is still awaiting Super Admin verification.", application };
  }
  if (organization.status === "rejected") {
    return { blocked: true, message: organization.verificationNote || "Your organization's verification application was rejected.", application };
  }
  if (organization.status === "suspended") {
    return { blocked: true, message: "Your organization's access is currently suspended. Contact support.", application };
  }
  if (user.verificationStatus === "pending") {
    return { blocked: true, message: "Your organization is approved, but your adjuster credentials are still awaiting verification.", application };
  }
  if (user.verificationStatus === "rejected") {
    return { blocked: true, message: user.verificationNote || "Your adjuster account application was rejected.", application };
  }
  if (user.verificationStatus === "suspended") {
    return { blocked: true, message: user.verificationNote || "Your adjuster account is currently suspended.", application };
  }
  if (user.verificationStatus !== "approved") {
    return { blocked: true, message: "Your adjuster account is not approved.", application };
  }
  return { blocked: false, application };
}

function setOtp(user, otp, purpose) {
  user.otpHash = hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  user.otpAttempts = 0;
  user.otpPurpose = purpose;
}

function clearOtp(user) {
  user.otpHash = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.otpPurpose = null;
}

function issueToken(user, remember = false) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: remember ? "30d" : "1d" }
  );
}

/**
 * POST /api/auth/signup
 * Body matches your SignUp form in Auth.jsx: { role, fullName, email, password,
 * acceptedTerms, orgName?, cac?, organizationLicenseNumber?, licenseNumber? }
 * Creates the account and sends a signup OTP. Policyholders enter the app
 * after verifying; adjusters continue to the application-status screen while
 * their organization and staff credentials are reviewed.
 */
async function signup(req, res) {
  try {
    const {
      role,
      fullName,
      email,
      phone,
      password,
      acceptedTerms,
      policyNumber,
      orgName,
      cac,
      organizationLicenseNumber,
      licenseNumber,
      claimCategories,
    } = req.body;

    const requestedRole = role || "applicant";
    if (!["applicant", "admin"].includes(requestedRole)) {
      return res.status(400).json({ message: "Choose either a Policy Holder or Adjuster account." });
    }

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Full name, email, and password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (acceptedTerms !== true) {
      return res.status(400).json({ message: "You must accept the Terms of Service and Privacy Policy." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    let organization = null;
    let createdOrganization = false;
    let categories = [];
    if (requestedRole === "admin") {
      if (!/^\+?[0-9][0-9\s()-]{7,19}$/.test(String(phone || "").trim())) {
        return res.status(400).json({ message: "Enter a valid work phone number." });
      }
      const validation = validateAdjusterApplication({
        orgName,
        cac,
        organizationLicenseNumber,
        licenseNumber,
        claimCategories,
      });
      if (validation.errors.length > 0) {
        return res.status(400).json({ message: validation.errors[0], errors: validation.errors });
      }
      categories = validation.categories;

      const normalizedName = normalizeOrganizationName(orgName);
      const normalizedCac = normalizeIdentifier(cac);
      const normalizedOrgLicense = normalizeIdentifier(organizationLicenseNumber);

      organization = await Organization.findOne({
        $or: [
          { normalizedName },
          { cacNumber: normalizedCac },
          { naicomLicenseNumber: normalizedOrgLicense },
        ],
      });

      if (organization) {
        const detailsMatch = organization.normalizedName === normalizedName
          && organization.cacNumber === normalizedCac
          && organization.naicomLicenseNumber === normalizedOrgLicense;
        if (!detailsMatch) {
          return res.status(409).json({
            message: "Those organization details conflict with an existing registration. Ask your organization administrator or RightTrack support to invite you.",
          });
        }
        if (["rejected", "suspended"].includes(organization.status)) {
          return res.status(403).json({ message: "This organization cannot accept new adjuster applications. Contact support." });
        }
        const unsupportedCategory = categories.find((category) => !organization.claimCategories.includes(category));
        if (unsupportedCategory) {
          return res.status(400).json({ message: `${organization.name} is not registered to handle ${unsupportedCategory} claims.` });
        }
      } else {
        organization = await Organization.create({
          name: orgName.trim().replace(/\s+/g, " "),
          normalizedName,
          cacNumber: normalizedCac,
          naicomLicenseNumber: normalizedOrgLicense,
          claimCategories: categories,
          status: "pending",
          auditTrail: [{ action: "submitted", note: `Submitted by ${normalizedEmail}` }],
        });
        createdOrganization = true;
      }

      const duplicateStaffId = await User.findOne({
        role: "admin",
        organization: organization._id,
        licenseNumber: normalizeIdentifier(licenseNumber),
      });
      if (duplicateStaffId) {
        return res.status(409).json({ message: "That staff or adjuster ID is already registered for this organization." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const signupOtp = generateOtp();

    const user = await User.create({
      role: requestedRole,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: requestedRole === "admin" ? phone.trim() : "",
      password: hashedPassword,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      policyNumber,
      organization: organization?._id || null,
      orgName: organization?.name,
      isRegisteredOrg: requestedRole === "admin" && createdOrganization,
      cac: organization?.cacNumber,
      organizationLicenseNumber: organization?.naicomLicenseNumber,
      licenseNumber: requestedRole === "admin" ? normalizeIdentifier(licenseNumber) : undefined,
      claimCategories: requestedRole === "admin" ? categories : undefined,
      verificationHistory: requestedRole === "admin"
        ? [{ status: "pending", note: "Adjuster credentials submitted for review." }]
        : [],
      otpHash: hashOtp(signupOtp),
      otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      otpAttempts: 0,
      otpPurpose: "signup",
    });

    if (organization && !organization.submittedBy) {
      organization.submittedBy = user._id;
      await organization.save();
    }

    let verificationEmailSent = null;
    try {
      await sendSignupVerificationEmail(user.email, signupOtp, requestedRole);
      verificationEmailSent = true;
    } catch (emailError) {
      verificationEmailSent = false;
      console.error("Signup verification delivery failed:", emailError.message);
    }

    return res.status(201).json({
      message: requestedRole === "admin"
        ? verificationEmailSent
          ? "Application received. Enter the OTP sent to your work email before your organization and staff credentials can be approved."
          : "Application received, but the verification email could not be delivered. Request a new code on the verification screen."
        : verificationEmailSent
          ? "Account created. Enter the OTP sent to your email to verify your policyholder account."
          : "Account created, but the verification email could not be delivered. Use Request a new one on the verification screen.",
      user: publicUser(user),
      organizationStatus: organization?.status,
      verificationEmailSent,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That email, organization registration, or staff ID is already registered." });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

async function verifySignupOtp(req, res) {
  try {
    const { email, otp, remember } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.isVerified || user.otpPurpose !== "signup" || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending account verification was found." });
    }
    if (user.otpExpiresAt < new Date()) {
      clearOtp(user);
      await user.save();
      return res.status(400).json({ message: "OTP has expired. Request a new code." });
    }
    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      clearOtp(user);
      await user.save();
      return res.status(429).json({ message: "Too many failed attempts. Request a new code." });
    }
    if (!verifyOtp(otp, user.otpHash)) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    clearOtp(user);
    user.isVerified = true;
    await user.save();

    if (user.role === "admin") {
      const state = await adjusterAccountState(user);
      return res.status(200).json({
        message: "Work email verified. Your application is now waiting for organization and adjuster approval.",
        user: publicUser(user),
        application: state.application,
      });
    }

    return res.status(200).json({
      message: "Policyholder email verified successfully.",
      token: issueToken(user, remember),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Signup OTP verification error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

async function resendSignupOtp(req, res) {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user || user.isVerified) {
      return res.status(400).json({ message: "No unverified account was found." });
    }

    const otp = generateOtp();
    setOtp(user, otp, "signup");
    await user.save();
    await sendSignupVerificationEmail(user.email, otp, user.role);

    return res.status(200).json({ message: "A new account verification code has been sent." });
  } catch (err) {
    console.error("Resend signup OTP error:", err);
    return res.status(500).json({ message: "The verification email could not be sent. Please try again." });
  }
}

/**
 * STEP 1 — POST /api/auth/login
 * Body: { email, password }
 * Verifies credentials, generates + emails an OTP, but does NOT log the user in yet.
 */
async function login(req, res) {
  try {
    const { email, password, requestedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = user.password && await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (requestedRole && user.role !== requestedRole) {
      return res.status(403).json({ message: "This account is registered for a different account type." });
    }
    if (user.role !== "superadmin" && !user.isVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email with the sign-up OTP before logging in.",
        email: user.email,
        role: user.role,
      });
    }

    const accountState = await adjusterAccountState(user);
    if (accountState.blocked) {
      return res.status(403).json({
        code: "ACCOUNT_PENDING",
        message: accountState.message,
        email: user.email,
        role: user.role,
        application: accountState.application,
      });
    }

    const otp = generateOtp();
    setOtp(user, otp, "login");
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      message: "OTP sent to your registered email.",
      email: user.email, // frontend carries this forward to the verify screen
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * STEP 2 — POST /api/auth/verify-otp
 * Body: { email, otp }
 * Verifies the OTP and, if valid, issues a JWT.
 */
async function verifyOtpHandler(req, res) {
  try {
    const { email, otp, remember } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.otpPurpose !== "login" || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending login verification for this account." });
    }

    if (user.otpExpiresAt < new Date()) {
      clearOtp(user);
      await user.save();
      return res.status(400).json({ message: "OTP has expired. Please log in again." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      clearOtp(user);
      await user.save();
      return res.status(429).json({ message: "Too many failed attempts. Please log in again." });
    }

    const accountState = await adjusterAccountState(user);
    if (accountState.blocked) {
      clearOtp(user);
      await user.save();
      return res.status(403).json({
        code: "ACCOUNT_PENDING",
        message: accountState.message,
        email: user.email,
        role: user.role,
        application: accountState.application,
      });
    }

    const isValid = verifyOtp(otp, user.otpHash);
    if (!isValid) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    // Success — clear OTP fields, mark verified, issue token
    clearOtp(user);
    user.isVerified = true;
    await user.save();

    const token = issueToken(user, remember);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * POST /api/auth/resend-otp
 * Body: { email }
 * Generates a fresh OTP if the user has a pending login attempt.
 */
async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });

    if (!user || user.otpPurpose !== "login") {
      return res.status(400).json({ message: "No pending login verification for this account." });
    }

    const otp = generateOtp();
    setOtp(user, otp, "login");
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.status(200).json({ message: "A new OTP has been sent." });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * GET /api/auth/me
 * Requires a valid JWT (Authorization: Bearer <token>).
 * Returns the current user's info — used on app load to restore
 * a session from a token saved in localStorage.
 */
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("-password -otpHash -otpExpiresAt -otpAttempts -otpPurpose -verificationHistory")
      .populate("organization", "name status claimCategories");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    console.error("Me endpoint error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * POST /api/auth/google
 * Body: { credential, role, remember }
 * `credential` is the ID token Google's Sign-In button hands back to the frontend.
 * We verify it server-side, then use it only to log in an existing, verified
 * policyholder. Initial registration must use the signup form and email OTP.
 */
async function googleAuth(req, res) {
  try {
    const { credential, role, remember } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(400).json({ message: "Google email is not verified." });
    }

    const email = payload.email.toLowerCase().trim();
    let user = await User.findOne({ email });

    if (user?.role === "superadmin") {
      return res.status(403).json({ message: "Use the dedicated Super Admin login and email OTP." });
    }

    if (!user) {
      return res.status(404).json({
        message: "Create and verify your Policy Holder account with the signup form before using Google login.",
      });
    }

    if (user.role !== "applicant") {
      return res.status(403).json({ message: "Adjusters must log in with their work email, password, and OTP." });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email with the sign-up OTP before using Google login.",
        email: user.email,
      });
    }

    if (!user.isGoogleAccount) {
      // Link Google only after the original email/OTP signup has been completed.
      user.isGoogleAccount = true;
      await user.save();
    }

    // If the person picked a different account type on screen than what
    // this email is actually registered as, stop and explain — don't
    // silently drop them into the wrong dashboard.
    if (role && role !== user.role) {
      const roleLabel = { applicant: "Policy Holder", admin: "Adjuster" };
      return res.status(409).json({
        message: `This Google account is already registered as a ${roleLabel[user.role] || user.role}, not a ${roleLabel[role] || role}. Please switch tabs and log in as the correct account type, or use a different email to sign up as a ${roleLabel[role] || role}.`,
      });
    }

    const blocked = await accountBlockMessage(user);
    if (blocked) return res.status(403).json({ message: blocked });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: remember ? "30d" : "1d" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Generates + emails an OTP for resetting the password. Always responds
 * with a generic success message, even if the email isn't registered —
 * this avoids revealing which emails have accounts.
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      const otp = generateOtp();
      setOtp(user, otp, "password_reset");
      await user.save();
      await sendPasswordResetEmail(user.email, otp);
    }

    // Same response whether or not the account exists.
    return res.status(200).json({ message: "If an account exists for that email, a reset code has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * POST /api/auth/verify-reset-otp
 * Body: { email, otp }
 * Checks the OTP is valid WITHOUT clearing it yet — the person still needs
 * to submit a new password next, which re-checks the same code.
 */
async function verifyResetOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.otpPurpose !== "password_reset" || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending password reset for this account." });
    }

    if (user.otpExpiresAt < new Date()) {
      clearOtp(user);
      await user.save();
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      clearOtp(user);
      await user.save();
      return res.status(429).json({ message: "Too many failed attempts. Please request a new code." });
    }

    if (!verifyOtp(otp, user.otpHash)) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    return res.status(200).json({ message: "Code verified." });
  } catch (err) {
    console.error("Verify reset OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword }
 * Re-checks the OTP (same as verify-reset-otp) and, if still valid,
 * updates the password and clears the OTP fields.
 */
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.otpPurpose !== "password_reset" || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending password reset for this account." });
    }
    if (user.otpExpiresAt < new Date()) {
      clearOtp(user);
      await user.save();
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }
    if (!verifyOtp(otp, user.otpHash)) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    clearOtp(user);
    await user.save();

    return res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

module.exports = {
  signup,
  verifySignupOtp,
  resendSignupOtp,
  login,
  verifyOtpHandler,
  resendOtp,
  me,
  googleAuth,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};

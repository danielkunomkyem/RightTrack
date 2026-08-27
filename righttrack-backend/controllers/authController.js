const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { generateOtp, hashOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail, sendPasswordResetEmail } = require("../utils/sendEmail");

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/signup
 * Body matches your SignUp form in Auth.jsx: { role, fullName, email, password,
 * policyNumber?, orgName?, isRegisteredOrg?, cac?, licenseNumber? }
 * Creates the account. Does NOT log them in — your frontend already routes
 * signup -> VerifyEmail -> enterApp, so this just creates the user record.
 */
async function signup(req, res) {
  console.log("SIGNUP endpoint hit. Body:", req.body);
  try {
    const { role, fullName, email, password, policyNumber, orgName, isRegisteredOrg, cac, licenseNumber, claimCategories } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Full name, email, and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("Checking for existing user with normalized email:", normalizedEmail);
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      console.log("Found existing account:", existing.email, "| id:", existing._id);
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.log("No existing account found — proceeding to create.");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      role: role || "applicant",
      fullName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      policyNumber,
      orgName,
      isRegisteredOrg,
      cac,
      licenseNumber,
      claimCategories: role === "admin" ? (Array.isArray(claimCategories) ? claimCategories : []) : undefined,
    });

    return res.status(201).json({
      message: role === "admin"
        ? "Account created. Your License/Staff ID and CAC number are now awaiting Super Admin approval — you'll be able to log in once approved."
        : "Account created.",
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, verificationStatus: user.verificationStatus },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

/**
 * STEP 1 — POST /api/auth/login
 * Body: { email, password }
 * Verifies credentials, generates + emails an OTP, but does NOT log the user in yet.
 */
async function login(req, res) {
  console.log("LOGIN endpoint hit. Body:", req.body);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log("No user found for email:", email);
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      console.log("Password did not match for:", email);
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.verificationStatus === "pending") {
      return res.status(403).json({ message: "Your adjuster account is still awaiting Super Admin approval. This usually takes 1–2 business days." });
    }
    if (user.verificationStatus === "rejected") {
      return res.status(403).json({ message: user.verificationNote || "Your adjuster account application was not approved. Contact support for details." });
    }

    const otp = generateOtp();
    console.log("Generated OTP for", email, ":", otp);
    user.otpHash = hashOtp(otp);
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();
    console.log("User OTP fields saved. Calling sendOtpEmail...");

    await sendOtpEmail(user.email, otp);
    console.log("sendOtpEmail call completed without throwing.");

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
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending verification for this account." });
    }

    if (user.otpExpiresAt < new Date()) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ message: "OTP has expired. Please log in again." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await user.save();
      return res.status(429).json({ message: "Too many failed attempts. Please log in again." });
    }

    const isValid = verifyOtp(otp, user.otpHash);
    if (!isValid) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    // Success — clear OTP fields, mark verified, issue token
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.isVerified = true;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: remember ? "30d" : "1d" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
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

    if (!user) {
      return res.status(400).json({ message: "No pending verification for this account." });
    }

    const otp = generateOtp();
    user.otpHash = hashOtp(otp);
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    user.otpAttempts = 0;
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
    const user = await User.findById(req.user.id).select("-password -otpHash -otpExpiresAt -otpAttempts");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error("Me endpoint error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * POST /api/auth/google
 * Body: { credential, role, remember }
 * `credential` is the ID token Google's Sign-In button hands back to the frontend.
 * We verify it server-side, then find-or-create the account and log them in
 * directly — no password, no OTP, since Google has already verified the email.
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

    if (!user) {
      if (role === "admin") {
        return res.status(400).json({ message: "Adjuster accounts need organization details — please use the full sign-up form instead of Google for your first sign-up." });
      }
      user = await User.create({
        role: role || "applicant",
        fullName: payload.name || email.split("@")[0],
        email,
        isGoogleAccount: true,
        isVerified: true,
      });
    } else if (!user.isGoogleAccount) {
      // An account with this email already exists via normal signup.
      // Link it: allow Google sign-in for it going forward too.
      user.isGoogleAccount = true;
      user.isVerified = true;
      await user.save();
    }

    // If the person picked a different account type on screen than what
    // this email is actually registered as, stop and explain — don't
    // silently drop them into the wrong dashboard.
    if (role && user.role !== "superadmin" && role !== user.role) {
      const roleLabel = { applicant: "Policy Holder", admin: "Adjuster" };
      return res.status(409).json({
        message: `This Google account is already registered as a ${roleLabel[user.role] || user.role}, not a ${roleLabel[role] || role}. Please switch tabs and log in as the correct account type, or use a different email to sign up as a ${roleLabel[role] || role}.`,
      });
    }

    if (user.verificationStatus === "pending") {
      return res.status(403).json({ message: "Your adjuster account is still awaiting Super Admin approval. This usually takes 1–2 business days." });
    }
    if (user.verificationStatus === "rejected") {
      return res.status(403).json({ message: user.verificationNote || "Your adjuster account application was not approved. Contact support for details." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: remember ? "30d" : "1d" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
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
      user.otpHash = hashOtp(otp);
      user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      user.otpAttempts = 0;
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
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending password reset for this account." });
    }

    if (user.otpExpiresAt < new Date()) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      user.otpHash = null;
      user.otpExpiresAt = null;
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
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No pending password reset for this account." });
    }
    if (user.otpExpiresAt < new Date()) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }
    if (!verifyOtp(otp, user.otpHash)) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    return res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

module.exports = { signup, login, verifyOtpHandler, resendOtp, me, googleAuth, forgotPassword, verifyResetOtp, resetPassword };

const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { createRateLimit } = require("../middleware/rateLimit");

const signupLimit = createRateLimit({ name: "signup", windowMs: 60 * 60 * 1000, max: 10 });
const loginLimit = createRateLimit({ name: "login", windowMs: 15 * 60 * 1000, max: 10, includeEmail: true });
const otpLimit = createRateLimit({ name: "otp", windowMs: 10 * 60 * 1000, max: 10, includeEmail: true });
const resendLimit = createRateLimit({ name: "resend", windowMs: 10 * 60 * 1000, max: 3, includeEmail: true });
const passwordResetLimit = createRateLimit({ name: "password-reset", windowMs: 15 * 60 * 1000, max: 5, includeEmail: true });

// POST /api/auth/signup       -> creates the account
router.post("/signup", signupLimit, signup);

// POST /api/auth/verify-signup-otp -> verifies a new policyholder and returns a session
router.post("/verify-signup-otp", otpLimit, verifySignupOtp);

// POST /api/auth/resend-signup-otp -> replaces an expired/lost sign-up code
router.post("/resend-signup-otp", resendLimit, resendSignupOtp);

// POST /api/auth/login        -> checks email+password, sends OTP
router.post("/login", loginLimit, login);

// POST /api/auth/google       -> verifies Google ID token, logs in directly
router.post("/google", googleAuth);

// POST /api/auth/verify-otp   -> checks OTP, returns JWT
router.post("/verify-otp", otpLimit, verifyOtpHandler);

// POST /api/auth/resend-otp   -> sends a new OTP if the old one expired
router.post("/resend-otp", resendLimit, resendOtp);

// GET  /api/auth/me           -> returns current user if token is valid
router.get("/me", requireAuth, me);

// POST /api/auth/forgot-password   -> sends a password reset OTP
router.post("/forgot-password", passwordResetLimit, forgotPassword);

// POST /api/auth/verify-reset-otp  -> checks the reset OTP is valid
router.post("/verify-reset-otp", otpLimit, verifyResetOtp);

// POST /api/auth/reset-password    -> sets a new password after OTP check
router.post("/reset-password", otpLimit, resetPassword);

module.exports = router;

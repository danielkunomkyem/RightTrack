const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    password: {
      type: String,
      required: function () { return !this.isGoogleAccount; }, // Google accounts don't set a password
    },
    isGoogleAccount: { type: Boolean, default: false },

    // Recorded when the user explicitly accepts the signup agreements.
    termsAcceptedAt: { type: Date, default: null },
    privacyAcceptedAt: { type: Date, default: null },

    role: { type: String, enum: ["applicant", "admin", "superadmin"], default: "applicant" },

    // Policy holder-specific
    policyNumber: { type: String, trim: true },

    // Adjuster-specific
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    orgName: { type: String, trim: true },
    isRegisteredOrg: { type: Boolean, default: false },
    claimCategories: { type: [String], default: [] }, // which claim types this org handles
    cac: { type: String, trim: true },
    organizationLicenseNumber: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },

    // --- One-time code fields ---
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpPurpose: {
      type: String,
      enum: ["signup", "login", "password_reset", null],
      default: null,
    },
    isVerified: { type: Boolean, default: false },

    // --- Adjuster verification (Super Admin manually reviews License/CAC) ---
    verificationStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected", "suspended"],
      default: function () { return this.role === "admin" ? "pending" : "not_required"; },
    },
    verificationNote: { type: String, default: "" }, // optional reason if rejected
    verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationReviewedAt: { type: Date, default: null },
    verificationHistory: {
      type: [{
        status: { type: String, enum: ["pending", "approved", "rejected", "suspended"] },
        note: { type: String, trim: true, default: "" },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        at: { type: Date, default: Date.now },
        _id: false,
      }],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.index(
  { organization: 1, licenseNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      organization: { $type: "objectId" },
      licenseNumber: { $type: "string" },
      role: "admin",
    },
  }
);

module.exports = mongoose.model("User", userSchema);

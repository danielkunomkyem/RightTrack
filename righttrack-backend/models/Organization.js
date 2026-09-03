const mongoose = require("mongoose");

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["submitted", "approved", "rejected", "suspended", "reactivated"],
      required: true,
    },
    note: { type: String, trim: true, default: "" },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, trim: true },
    cacNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    naicomLicenseNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    claimCategories: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    verificationNote: { type: String, trim: true, default: "" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    auditTrail: { type: [auditEntrySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);

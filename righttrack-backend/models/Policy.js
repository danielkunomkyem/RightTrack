const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    policyId: { type: String, required: true, trim: true }, // e.g. "LDW/2026/12345"
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    insurer: { type: String, required: true }, // must match an adjuster's orgName
    category: { type: String, required: true }, // which claim category this policy covers
    policyholderEmail: { type: String, trim: true, lowercase: true, default: null }, // optional: restrict to one person
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A given policy number only means one thing per insurer.
policySchema.index({ policyId: 1, insurer: 1 }, { unique: true });

module.exports = mongoose.model("Policy", policySchema);

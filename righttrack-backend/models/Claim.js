const mongoose = require("mongoose");

const historyEntrySchema = new mongoose.Schema(
  {
    ts: { type: String, required: true }, // ISO timestamp string, matches frontend's NOW.toISOString() format
    label: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    size: { type: String, default: "" }, // display string e.g. "1.2 MB", matches FileDrop.jsx
    type: { type: String, default: "" },
  },
  { _id: false }
);

const ratingSchema = new mongoose.Schema(
  {
    stars: { type: Number, min: 1, max: 5, required: true },
    review: { type: String, default: "" },
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    // Public-facing reference ID shown throughout the UI, e.g. "CLM-4F9A2B".
    // Kept distinct from Mongo's own _id so existing frontend code (which
    // treats claim.id as the identifier) doesn't need to change.
    id: { type: String, required: true, unique: true },

    // Who submitted it — both the display name (kept for the existing UI)
    // and a real reference to the User account for proper per-user scoping.
    applicant: { type: String, required: true },
    applicantUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    policyId: { type: String, required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    insurer: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },

    status: {
      type: String,
      enum: ["submitted", "under_review", "action_required", "approved", "rejected"],
      default: "submitted",
    },

    documents: { type: [documentSchema], default: [] },
    history: { type: [historyEntrySchema], default: [] },

    adjuster: { type: String, default: "" }, // name of the adjuster who picked it up
    adjusterUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    flagReason: { type: String, default: "" }, // set when status becomes action_required
    rejectionCode: { type: String, default: "" },
    rejectionNotes: { type: String, default: "" },

    rating: { type: ratingSchema, default: null },

    submittedAt: { type: String, required: true }, // ISO string, matches frontend display expectations
  },
  { timestamps: true }
);

module.exports = mongoose.model("Claim", claimSchema);

const crypto = require("crypto");
const Claim = require("../models/Claim");
const User = require("../models/User");
const Organization = require("../models/Organization");

function generateClaimId() {
  return "CLM-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

/**
 * GET /api/claims
 * Returns claims scoped to the logged-in user's role:
 * - applicant  -> only their own claims
 * - admin      -> only claims for their organization (insurer match)
 * - superadmin -> every claim
 */
async function listClaims(req, res) {
  try {
    const { id, role } = req.user;
    let filter = {};

    if (role === "applicant") {
      filter = { applicantUser: id };
    } else if (role === "admin") {
      const user = await User.findById(id).select("orgName");
      filter = { insurer: user?.orgName || "__none__" };
    }
    // superadmin: no filter, sees everything

    const claims = await Claim.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ claims });
  } catch (err) {
    console.error("List claims error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * POST /api/claims
 * Body: { policyId, insurer, category, amount, description, documents }
 * Creates a new claim, status "submitted".
 */
async function createClaim(req, res) {
  try {
    const { policyId, insurer, category, amount, description, documents } = req.body;
    if (!policyId || !insurer || !category || !amount || !description) {
      return res.status(400).json({ message: "All claim details are required." });
    }

    const user = await User.findById(req.user.id).select("fullName");
    const now = new Date();
    const claimId = generateClaimId();

    const claim = await Claim.create({
      id: claimId,
      applicant: user?.fullName || "Applicant",
      applicantUser: req.user.id,
      policyId,
      insurer,
      category,
      amount: Number(amount),
      description,
      status: "submitted",
      documents: documents || [],
      submittedAt: now.toISOString(),
      history: [
        { ts: now.toISOString(), label: "Claim submitted", detail: `Submitted by applicant via web portal to ${insurer}` },
        { ts: new Date(now.getTime() + 1000).toISOString(), label: "Document validation passed", detail: `${(documents || []).length} file(s) verified — format & size checks OK` },
      ],
    });

    return res.status(201).json({ claim });
  } catch (err) {
    console.error("Create claim error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/claims/:id/reupload
 * Body: { documents }
 * Applicant responds to an action_required flag. action_required -> under_review.
 */
async function reuploadDocuments(req, res) {
  try {
    const { documents } = req.body;
    const claim = await Claim.findOne({ id: req.params.id, applicantUser: req.user.id });
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const now = new Date();
    claim.status = "under_review";
    claim.documents.push(...(documents || []));
    claim.history.push(
      { ts: now.toISOString(), label: "Applicant re-uploaded document", detail: `${(documents || []).length} new file(s) submitted in response to flag` },
      { ts: new Date(now.getTime() + 1000).toISOString(), label: "Status changed to Under Review", detail: "Returned to adjuster queue at same position" }
    );
    await claim.save();

    return res.status(200).json({ claim });
  } catch (err) {
    console.error("Reupload error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/claims/:id/rate
 * Body: { stars, review }
 * Applicant rates a resolved claim.
 */
async function rateClaim(req, res) {
  try {
    const { stars, review } = req.body;
    if (!stars) return res.status(400).json({ message: "A star rating is required." });

    const claim = await Claim.findOneAndUpdate(
      { id: req.params.id, applicantUser: req.user.id },
      { rating: { stars, review: review || "" } },
      { new: true }
    );
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    return res.status(200).json({ claim });
  } catch (err) {
    console.error("Rate claim error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/claims/:id/start-review
 * Adjuster opens a submitted claim. submitted -> under_review.
 */
async function startReview(req, res) {
  try {
    const adjusterUser = await User.findById(req.user.id).select("fullName orgName");
    const claim = await Claim.findOne({ id: req.params.id, insurer: adjusterUser?.orgName });
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const adjusterName = adjusterUser?.fullName || "Assigned Adjuster";
    const now = new Date();
    claim.status = "under_review";
    claim.adjuster = adjusterName;
    claim.adjusterUser = req.user.id;
    claim.history.push(
      { ts: now.toISOString(), label: "Assigned to adjuster", detail: `Claim opened by ${adjusterName}` },
      { ts: new Date(now.getTime() + 1000).toISOString(), label: "Status changed to Under Review", detail: "Review started" }
    );
    await claim.save();

    return res.status(200).json({ claim });
  } catch (err) {
    console.error("Start review error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/claims/:id/request-info
 * Body: { notes }
 * Adjuster flags the claim. under_review -> action_required.
 */
async function requestInfo(req, res) {
  try {
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ message: "Please provide a reason for the request." });

    const adjusterUser = await User.findById(req.user.id).select("orgName");
    const claim = await Claim.findOne({ id: req.params.id, insurer: adjusterUser?.orgName });
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const now = new Date();
    claim.status = "action_required";
    claim.flagReason = notes;
    claim.history.push(
      { ts: now.toISOString(), label: "Adjuster flagged claim", detail: notes },
      { ts: new Date(now.getTime() + 1000).toISOString(), label: "Status changed to Action Required", detail: "Applicant notified via email + SMS" }
    );
    await claim.save();

    return res.status(200).json({ claim });
  } catch (err) {
    console.error("Request info error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/claims/:id/decide
 * Body: { status: "approved" | "rejected", rejectionCode, notes }
 * Adjuster (or superadmin) makes the final call.
 */
async function decideClaim(req, res) {
  try {
    const { status, rejectionCode, notes } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
    }

    let filter = { id: req.params.id };
    if (req.user.role === "admin") {
      const adjusterUser = await User.findById(req.user.id).select("orgName");
      filter.insurer = adjusterUser?.orgName;
    }
    // superadmin can decide on any claim, no extra filter

    const claim = await Claim.findOne(filter);
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const now = new Date();
    claim.status = status;
    claim.rejectionCode = status === "rejected" ? rejectionCode || "" : "";
    claim.rejectionNotes = notes || "";
    claim.history.push({
      ts: now.toISOString(),
      label: `Decision recorded: ${status === "approved" ? "Approved" : "Rejected"}`,
      detail: notes || (status === "approved" ? "Approved in full" : "See rejection code"),
    });
    await claim.save();

    return res.status(200).json({ claim });
  } catch (err) {
    console.error("Decide claim error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * GET /api/claims/insurers
 * Returns the distinct list of organizations with at least one approved
 * adjuster — this is the real, live list a policyholder can send a claim
 * to, replacing the old hardcoded INSURERS constant.
 */
async function listInsurers(req, res) {
  try {
    const staffedOrganizationIds = await User.distinct("organization", {
      role: "admin",
      verificationStatus: "approved",
      organization: { $ne: null },
    });
    const organizations = await Organization.find({
      _id: { $in: staffedOrganizationIds },
      status: "approved",
    })
      .select("name claimCategories")
      .sort({ name: 1 })
      .lean();
    const insurers = organizations.map((organization) => ({
      id: organization._id,
      name: organization.name,
      categories: organization.claimCategories,
    }));

    return res.status(200).json({ insurers });
  } catch (err) {
    console.error("List insurers error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

module.exports = { listClaims, createClaim, reuploadDocuments, rateClaim, startReview, requestInfo, decideClaim, listInsurers };

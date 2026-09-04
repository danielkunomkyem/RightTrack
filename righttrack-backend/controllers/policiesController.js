const crypto = require("crypto");
const Policy = require("../models/Policy");
const User = require("../models/User");
const { sendPolicyAssignedEmail } = require("../utils/sendEmail");

function generatePolicyId() {
  return "POL-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

/**
 * POST /api/policies
 * Body: { policyholderEmail, category }
 * Adjuster assigns a brand-new, system-generated policy number to a specific
 * policyholder's email — no manual typing, no chance of a typo mismatch.
 */
async function registerPolicy(req, res) {
  try {
    const { policyholderEmail, category } = req.body;
    if (!policyholderEmail || !category) {
      return res.status(400).json({ message: "Policyholder email and category are required." });
    }

    if (!req.user.organizationId || !req.user.orgName) {
      return res.status(400).json({ message: "Your account has no organization on file." });
    }

    const email = policyholderEmail.toLowerCase().trim();

    // Generate a unique ID, retrying on the rare collision.
    let policyId;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePolicyId();
      const clash = await Policy.findOne({ policyId: candidate, organization: req.user.organizationId });
      if (!clash) {
        policyId = candidate;
        break;
      }
    }
    if (!policyId) {
      return res.status(500).json({ message: "Couldn't generate a unique policy ID. Please try again." });
    }

    const policy = await Policy.create({
      policyId,
      organization: req.user.organizationId,
      insurer: req.user.orgName,
      category,
      policyholderEmail: email,
      registeredBy: req.user.id,
    });

    await sendPolicyAssignedEmail(email, policyId, req.user.orgName, category);

    return res.status(201).json({ policy });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That policy ID already exists — please try again." });
    }
    console.error("Register policy error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * GET /api/policies
 * Adjuster: lists policies registered for their own organization.
 */
async function listPolicies(req, res) {
  try {
    const policies = await Policy.find({
      $or: [
        { organization: req.user.organizationId },
        { organization: null, insurer: req.user.orgName },
      ],
    }).sort({ createdAt: -1 });
    return res.status(200).json({ policies });
  } catch (err) {
    console.error("List policies error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * PATCH /api/policies/:id/deactivate
 * Adjuster: deactivates a policy so it can no longer be used for new claims.
 */
async function deactivatePolicy(req, res) {
  try {
    const policy = await Policy.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { organization: req.user.organizationId },
          { organization: null, insurer: req.user.orgName },
        ],
      },
      { isActive: false },
      { new: true }
    );
    if (!policy) return res.status(404).json({ message: "Policy not found." });
    return res.status(200).json({ policy });
  } catch (err) {
    console.error("Deactivate policy error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * Used internally by claimsController to validate a claim's Policy ID
 * against what's genuinely on file for that insurer + category.
 */
async function findValidPolicy(policyId, policyholderEmail) {
  return Policy.findOne({
    policyId: (policyId || "").trim(),
    policyholderEmail: (policyholderEmail || "").toLowerCase().trim(),
    isActive: true,
  }).populate("organization", "name status");
}

/**
 * GET /api/policies/mine
 * Any logged-in user: lists the policy numbers assigned to THEIR email.
 */
async function listMyPolicies(req, res) {
  try {
    const user = await User.findById(req.user.id).select("email");
    const policies = await Policy.find({ policyholderEmail: user.email, isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ policies });
  } catch (err) {
    console.error("List my policies error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

module.exports = { registerPolicy, listPolicies, deactivatePolicy, findValidPolicy, listMyPolicies };

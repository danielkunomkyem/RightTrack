const mongoose = require("mongoose");
const User = require("../models/User");
const Organization = require("../models/Organization");

function invalidId(id) {
  return !mongoose.isValidObjectId(id);
}

function publicAdjuster(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    organization: user.organization,
    licenseNumber: user.licenseNumber,
    claimCategories: user.claimCategories,
    verificationStatus: user.verificationStatus,
    verificationNote: user.verificationNote,
    verificationReviewedAt: user.verificationReviewedAt,
  };
}

async function listPendingOrganizations(req, res) {
  try {
    const organizations = await Organization.find({ status: "pending" })
      .select("name cacNumber naicomLicenseNumber claimCategories status submittedBy createdAt auditTrail")
      .populate("submittedBy", "fullName email licenseNumber isVerified")
      .sort({ createdAt: 1 });

    return res.status(200).json({ organizations });
  } catch (err) {
    console.error("List pending organizations error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

async function approveOrganization(req, res) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Organization not found." });

    const organization = await Organization.findOne({ _id: req.params.id, status: "pending" });
    if (!organization) return res.status(404).json({ message: "Pending organization not found." });
    const submittingUser = organization.submittedBy
      ? await User.findById(organization.submittedBy).select("isVerified")
      : null;
    if (!submittingUser?.isVerified) {
      return res.status(409).json({ message: "The submitting adjuster must verify their work email before this organization can be approved." });
    }

    const now = new Date();
    organization.status = "approved";
    organization.verificationNote = (req.body.note || "").trim();
    organization.reviewedBy = req.user.id;
    organization.reviewedAt = now;
    organization.auditTrail.push({
      action: "approved",
      note: organization.verificationNote,
      actor: req.user.id,
      at: now,
    });
    await organization.save();

    return res.status(200).json({ message: `${organization.name} approved.`, organization });
  } catch (err) {
    console.error("Approve organization error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

async function rejectOrganization(req, res) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Organization not found." });
    const note = (req.body.note || "").trim();
    if (!note) return res.status(400).json({ message: "A rejection reason is required." });

    const organization = await Organization.findOne({ _id: req.params.id, status: "pending" });
    if (!organization) return res.status(404).json({ message: "Pending organization not found." });

    const now = new Date();
    organization.status = "rejected";
    organization.verificationNote = note;
    organization.reviewedBy = req.user.id;
    organization.reviewedAt = now;
    organization.auditTrail.push({ action: "rejected", note, actor: req.user.id, at: now });
    await organization.save();

    return res.status(200).json({ message: `${organization.name} rejected.`, organization });
  } catch (err) {
    console.error("Reject organization error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

async function listPendingAdjusters(req, res) {
  try {
    const adjusters = await User.find({ role: "admin", verificationStatus: "pending" })
      .select("fullName email phone isVerified organization orgName licenseNumber cac organizationLicenseNumber claimCategories createdAt")
      .populate("organization", "name status cacNumber naicomLicenseNumber claimCategories")
      .sort({ createdAt: 1 });

    return res.status(200).json({ adjusters });
  } catch (err) {
    console.error("List pending adjusters error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

async function approveAdjuster(req, res) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Adjuster not found." });

    const user = await User.findOne({ _id: req.params.id, role: "admin", verificationStatus: "pending" })
      .populate("organization", "name status");
    if (!user) return res.status(404).json({ message: "Pending adjuster not found." });
    if (!user.isVerified) {
      return res.status(409).json({ message: "The adjuster must verify their work email before approval." });
    }
    if (!user.organization || user.organization.status !== "approved") {
      return res.status(409).json({ message: "Approve the adjuster's organization before approving this account." });
    }

    const now = new Date();
    user.orgName = user.organization.name;
    user.verificationStatus = "approved";
    user.verificationNote = "";
    user.verificationReviewedBy = req.user.id;
    user.verificationReviewedAt = now;
    user.verificationHistory.push({ status: "approved", actor: req.user.id, at: now });
    await user.save();

    return res.status(200).json({ message: `${user.fullName} approved.`, user: publicAdjuster(user) });
  } catch (err) {
    console.error("Approve adjuster error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

async function rejectAdjuster(req, res) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Adjuster not found." });
    const note = (req.body.note || "").trim();
    if (!note) return res.status(400).json({ message: "A rejection reason is required." });

    const user = await User.findOne({ _id: req.params.id, role: "admin", verificationStatus: "pending" });
    if (!user) return res.status(404).json({ message: "Pending adjuster not found." });

    const now = new Date();
    user.verificationStatus = "rejected";
    user.verificationNote = note;
    user.verificationReviewedBy = req.user.id;
    user.verificationReviewedAt = now;
    user.verificationHistory.push({ status: "rejected", note, actor: req.user.id, at: now });
    await user.save();

    return res.status(200).json({ message: `${user.fullName} rejected.`, user: publicAdjuster(user) });
  } catch (err) {
    console.error("Reject adjuster error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

module.exports = {
  listPendingOrganizations,
  approveOrganization,
  rejectOrganization,
  listPendingAdjusters,
  approveAdjuster,
  rejectAdjuster,
};

const Claim = require("../models/Claim");
const Message = require("../models/Message");

// Checks whether the logged-in user is allowed to see/send messages on this
// claim: the policyholder who owns it, an adjuster from the same insurer,
// or a Super Admin.
async function canAccessClaim(claim, reqUser) {
  if (reqUser.role === "superadmin") return true;
  if (reqUser.role === "applicant") return claim.applicantUser.toString() === reqUser.id;
  if (reqUser.role === "admin") {
    return claim.organization
      ? claim.organization.toString() === reqUser.organizationId
      : claim.insurer === reqUser.orgName;
  }
  return false;
}

/**
 * GET /api/claims/:id/messages
 * Returns the full message thread for a claim, oldest first.
 */
async function listMessages(req, res) {
  try {
    const claim = await Claim.findOne({ id: req.params.id });
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const allowed = await canAccessClaim(claim, req.user);
    if (!allowed) return res.status(403).json({ message: "You don't have access to this claim." });

    const messages = await Message.find({ claim: claim._id }).sort({ createdAt: 1 });
    return res.status(200).json({ messages });
  } catch (err) {
    console.error("List messages error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

/**
 * POST /api/claims/:id/messages
 * Body: { body }
 */
async function sendMessage(req, res) {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ message: "Message can't be empty." });
    }

    const claim = await Claim.findOne({ id: req.params.id });
    if (!claim) return res.status(404).json({ message: "Claim not found." });

    const allowed = await canAccessClaim(claim, req.user);
    if (!allowed) return res.status(403).json({ message: "You don't have access to this claim." });

    const sender = await User.findById(req.user.id).select("fullName role");

    const message = await Message.create({
      claim: claim._id,
      sender: req.user.id,
      senderName: sender.fullName,
      senderRole: sender.role,
      body: body.trim(),
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error("Send message error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
}

module.exports = { listMessages, sendMessage };

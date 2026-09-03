const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");

// Reads the "Authorization: Bearer <token>" header, verifies it,
// and attaches the decoded payload (id, role) to req.user.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role isVerified verificationStatus organization orgName");
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ message: "Verify your email before accessing this account." });
    }

    if (user.role === "admin") {
      if (user.verificationStatus !== "approved") {
        return res.status(403).json({ message: "Your adjuster access is not active." });
      }
      const organization = user.organization
        ? await Organization.findById(user.organization).select("name status")
        : null;
      if (!organization || organization.status !== "approved") {
        return res.status(403).json({ message: "Your organization's access is not active." });
      }
      req.user = {
        id: user._id.toString(),
        role: user.role,
        organizationId: organization._id.toString(),
        orgName: organization.name,
      };
    } else {
      req.user = { id: user._id.toString(), role: user.role };
    }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

// Restricts a route to specific roles, e.g. requireRole("admin", "superadmin").
// Must be used AFTER requireAuth, since it reads req.user.role.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to do that." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

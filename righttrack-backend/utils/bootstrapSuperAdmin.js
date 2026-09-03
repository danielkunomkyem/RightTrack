const bcrypt = require("bcrypt");
const User = require("../models/User");

async function ensureSuperAdmin() {
  const email = (process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || "";

  if (!email || !password) {
    console.warn("Super Admin bootstrap skipped: set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD.");
    return null;
  }
  if (password.length < 12) {
    throw new Error("SUPERADMIN_PASSWORD must contain at least 12 characters.");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "superadmin") {
      throw new Error("SUPERADMIN_EMAIL is already used by a non-superadmin account.");
    }
    return existing;
  }

  const superAdmin = await User.create({
    fullName: process.env.SUPERADMIN_NAME || "System Administrator",
    email,
    password: await bcrypt.hash(password, 12),
    role: "superadmin",
    isVerified: true,
    verificationStatus: "not_required",
  });
  console.log(`Super Admin account created for ${superAdmin.email}.`);
  return superAdmin;
}

module.exports = ensureSuperAdmin;

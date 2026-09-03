const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");

test("policyholder records accept a dedicated signup OTP purpose", () => {
  const user = new User({
    fullName: "Ada Policyholder",
    email: "ada@example.com",
    password: "hashed-password-placeholder",
    role: "applicant",
    otpHash: "hashed-code",
    otpExpiresAt: new Date(Date.now() + 60_000),
    otpPurpose: "signup",
  });

  assert.equal(user.validateSync(), undefined);
  assert.equal(user.isVerified, false);
  assert.equal(user.otpPurpose, "signup");
});

test("unknown OTP purposes are rejected by the user model", () => {
  const user = new User({
    fullName: "Ada Policyholder",
    email: "ada@example.com",
    password: "hashed-password-placeholder",
    role: "applicant",
    otpPurpose: "claim_approval",
  });

  const error = user.validateSync();
  assert.ok(error.errors.otpPurpose);
});

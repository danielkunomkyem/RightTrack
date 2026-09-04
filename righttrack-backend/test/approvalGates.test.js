const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { approveOrganization, approveAdjuster } = require("../controllers/adminController");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("organization approval is blocked until the submitting work email is verified", async (t) => {
  const originalFindOne = Organization.findOne;
  const originalFindById = User.findById;
  t.after(() => {
    Organization.findOne = originalFindOne;
    User.findById = originalFindById;
  });

  const organizationId = new mongoose.Types.ObjectId();
  const submitterId = new mongoose.Types.ObjectId();
  Organization.findOne = async () => ({
    _id: organizationId,
    name: "Anchorline Insurance",
    status: "pending",
    submittedBy: submitterId,
  });
  User.findById = () => ({ select: async () => ({ isVerified: false }) });

  const req = { params: { id: organizationId.toString() }, body: {}, user: { id: new mongoose.Types.ObjectId().toString() } };
  const res = responseRecorder();
  await approveOrganization(req, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /verify their work email/i);
});

test("adjuster approval is blocked until the work email is verified", async (t) => {
  const originalFindOne = User.findOne;
  t.after(() => { User.findOne = originalFindOne; });

  const adjusterId = new mongoose.Types.ObjectId();
  User.findOne = () => ({
    populate: async () => ({
      _id: adjusterId,
      fullName: "Amina Adjuster",
      isVerified: false,
      verificationStatus: "pending",
      organization: { status: "approved" },
    }),
  });

  const req = { params: { id: adjusterId.toString() }, body: {}, user: { id: new mongoose.Types.ObjectId().toString() } };
  const res = responseRecorder();
  await approveAdjuster(req, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /verify their work email/i);
});

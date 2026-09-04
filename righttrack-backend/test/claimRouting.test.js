const test = require("node:test");
const assert = require("node:assert/strict");

test("claim routing ignores browser organization and category values", async () => {
  const Claim = require("../models/Claim");
  const User = require("../models/User");
  const policiesController = require("../controllers/policiesController");
  const claimsControllerPath = require.resolve("../controllers/claimsController");

  const originalFindById = User.findById;
  const originalCreate = Claim.create;
  const originalFindValidPolicy = policiesController.findValidPolicy;
  let createdPayload;

  User.findById = () => ({
    select: async () => ({ fullName: "Ada Policyholder", email: "ada@example.com" }),
  });
  policiesController.findValidPolicy = async () => ({
    policyId: "POL-VERIFIED",
    category: "Health",
    insurer: "Verified Insurance",
    organization: {
      _id: "507f1f77bcf86cd799439011",
      name: "Verified Insurance",
      status: "approved",
    },
  });
  Claim.create = async (payload) => {
    createdPayload = payload;
    return payload;
  };

  delete require.cache[claimsControllerPath];
  const { createClaim } = require(claimsControllerPath);

  const req = {
    user: { id: "507f191e810c19729de860ea", role: "applicant" },
    body: {
      fullName: "Chinwe Claimant",
      policyId: "POL-VERIFIED",
      insurer: "Forged Organization",
      category: "Forged Category",
      amount: 250000,
      description: "A covered incident with enough detail.",
      documents: [{ name: "evidence.pdf", size: "20 KB", type: "application/pdf" }],
    },
  };
  let statusCode;
  let responseBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  try {
    await createClaim(req, res);
    assert.equal(statusCode, 201);
    assert.equal(createdPayload.applicant, "Chinwe Claimant");
    assert.equal(createdPayload.policyId, "POL-VERIFIED");
    assert.equal(createdPayload.insurer, "Verified Insurance");
    assert.equal(createdPayload.category, "Health");
    assert.equal(String(createdPayload.organization), "507f1f77bcf86cd799439011");
    assert.equal(responseBody.claim, createdPayload);
  } finally {
    User.findById = originalFindById;
    Claim.create = originalCreate;
    policiesController.findValidPolicy = originalFindValidPolicy;
    delete require.cache[claimsControllerPath];
  }
});

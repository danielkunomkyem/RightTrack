const test = require("node:test");
const assert = require("node:assert/strict");

test("policy validation matches the entered number to the logged-in email", async () => {
  const Policy = require("../models/Policy");
  const User = require("../models/User");
  const { validatePolicy } = require("../controllers/policiesController");

  const originalFindOne = Policy.findOne;
  const originalFindById = User.findById;
  let policyQuery;

  Policy.findOne = (query) => {
    policyQuery = query;
    return {
      populate: async () => ({
        policyId: "POL-4A8C12EF",
        category: "Health",
        insurer: "Verified Insurance",
        organization: {
          _id: "507f1f77bcf86cd799439011",
          name: "Verified Insurance",
          status: "approved",
        },
      }),
    };
  };
  User.findById = () => ({
    select: async () => ({ email: "owner@example.com" }),
  });

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
    await validatePolicy(
      {
        user: { id: "507f191e810c19729de860ea", role: "applicant" },
        body: { policyId: "pol-4a8c12ef" },
      },
      res
    );

    assert.equal(statusCode, 200);
    assert.deepEqual(policyQuery, {
      policyId: "POL-4A8C12EF",
      policyholderEmail: "owner@example.com",
      isActive: true,
    });
    assert.deepEqual(responseBody.policy, {
      policyId: "POL-4A8C12EF",
      insurer: "Verified Insurance",
      category: "Health",
    });
  } finally {
    Policy.findOne = originalFindOne;
    User.findById = originalFindById;
  }
});

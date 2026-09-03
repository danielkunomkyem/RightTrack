const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeOrganizationName,
  normalizeIdentifier,
  validateAdjusterApplication,
} = require("../utils/verification");

test("normalizes organization identities consistently", () => {
  assert.equal(normalizeOrganizationName("  Anchorline   Insurance "), "anchorline insurance");
  assert.equal(normalizeIdentifier(" rc 1234567 "), "RC 1234567");
});

test("accepts a complete adjuster verification application", () => {
  const result = validateAdjusterApplication({
    orgName: "Anchorline Insurance",
    cac: "RC 1234567",
    organizationLicenseNumber: "NAICOM/INS/0123",
    licenseNumber: "ADJ-2451",
    claimCategories: ["Health", "Health", "Warranty"],
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.categories, ["Health", "Warranty"]);
});

test("rejects unverified identifiers and unsupported categories", () => {
  const result = validateAdjusterApplication({
    orgName: "A",
    cac: "123",
    organizationLicenseNumber: "?",
    licenseNumber: "1",
    claimCategories: ["Unknown"],
  });

  assert.equal(result.errors.length, 5);
  assert.deepEqual(result.categories, []);
});

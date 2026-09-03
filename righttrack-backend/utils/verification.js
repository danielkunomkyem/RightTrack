const ALLOWED_CATEGORIES = ["Health", "Tuition/Loan", "Expense Reimbursement", "Warranty"];
const CAC_PATTERN = /^(RC|BN|IT)\s?\d{5,7}$/i;
const STAFF_ID_PATTERN = /^[A-Za-z]{2,}[-\s]?[A-Za-z0-9-]{3,}$/;
const NAICOM_LICENSE_PATTERN = /^[A-Za-z]{2,}(?:[-/\s]?[A-Za-z0-9]+){1,}$/;

function normalizeOrganizationName(value = "") {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeIdentifier(value = "") {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function validateAdjusterApplication(payload) {
  const errors = [];
  const categories = Array.isArray(payload.claimCategories)
    ? [...new Set(payload.claimCategories.filter((category) => ALLOWED_CATEGORIES.includes(category)))]
    : [];

  if (!payload.orgName || payload.orgName.trim().length < 2) errors.push("Organization name is required.");
  if (!CAC_PATTERN.test((payload.cac || "").trim())) errors.push("Enter a valid CAC number, for example RC 1234567.");
  if (!NAICOM_LICENSE_PATTERN.test((payload.organizationLicenseNumber || "").trim())) {
    errors.push("Enter the organization's regulatory licence number.");
  }
  if (!STAFF_ID_PATTERN.test((payload.licenseNumber || "").trim())) {
    errors.push("Enter a valid adjuster licence or staff ID.");
  }
  if (categories.length === 0) errors.push("Select at least one supported claim category.");

  return { errors, categories };
}

module.exports = {
  ALLOWED_CATEGORIES,
  CAC_PATTERN,
  STAFF_ID_PATTERN,
  NAICOM_LICENSE_PATTERN,
  normalizeOrganizationName,
  normalizeIdentifier,
  validateAdjusterApplication,
};

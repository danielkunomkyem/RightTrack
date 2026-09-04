const express = require("express");
const router = express.Router();
const { registerPolicy, listPolicies, deactivatePolicy, validatePolicy, listMyPolicies } = require("../controllers/policiesController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Adjuster-only management.
router.post("/", requireAuth, requireRole("admin"), registerPolicy);
router.get("/", requireAuth, requireRole("admin"), listPolicies);
router.patch("/:id/deactivate", requireAuth, requireRole("admin"), deactivatePolicy);

// Any logged-in user: see the policy numbers assigned to their own email.
router.get("/mine", requireAuth, listMyPolicies);
router.post("/validate", requireAuth, requireRole("applicant"), validatePolicy);

module.exports = router;

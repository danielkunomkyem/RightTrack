const express = require("express");
const router = express.Router();
const {
  listPendingOrganizations,
  approveOrganization,
  rejectOrganization,
  listPendingAdjusters,
  approveAdjuster,
  rejectAdjuster,
} = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth, requireRole("superadmin"));

router.get("/pending-organizations", listPendingOrganizations);
router.patch("/organizations/:id/approve", approveOrganization);
router.patch("/organizations/:id/reject", rejectOrganization);
router.get("/pending-adjusters", listPendingAdjusters);
router.patch("/adjusters/:id/approve", approveAdjuster);
router.patch("/adjusters/:id/reject", rejectAdjuster);

module.exports = router;

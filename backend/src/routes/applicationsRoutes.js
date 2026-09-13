const express = require("express");
const {
  getSummary,
  getSendingLimitStatus,
  listApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
  generateWithAI,
  applyToCompanies,
  sendApplication,
  sendManualEmail,
} = require("../controllers/applicationsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/summary", getSummary);
// Must come before "/:id" so "sending-limit" isn't parsed as an application id.
router.get("/sending-limit", getSendingLimitStatus);
router.get("/", listApplications);
router.get("/:id", getApplication);
router.post("/", createApplication);
router.patch("/:id/status", updateApplicationStatus);
router.post("/generate", generateWithAI);
router.post("/apply", applyToCompanies);
router.post("/compose-send", sendManualEmail);
router.post("/:id/send", sendApplication);

module.exports = router;

const express = require("express");
const {
  getSummary,
  listApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
  generateWithAI,
  applyToCompanies,
  sendApplication,
} = require("../controllers/applicationsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/summary", getSummary);
router.get("/", listApplications);
router.get("/:id", getApplication);
router.post("/", createApplication);
router.patch("/:id/status", updateApplicationStatus);
router.post("/generate", generateWithAI);
router.post("/apply", applyToCompanies);
router.post("/:id/send", sendApplication);

module.exports = router;

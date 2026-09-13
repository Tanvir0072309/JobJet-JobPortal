const express = require("express");
const { listJobsForCompany, searchRealJobs } = require("../controllers/jobsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

// Real job openings finder for the Career page - must come before
// "/company/:companyId" would otherwise be fine either way since the path
// differs, but keeping search first for readability.
router.get("/search", searchRealJobs);
router.get("/company/:companyId", listJobsForCompany);

module.exports = router;

const express = require("express");
const { listJobsForCompany } = require("../controllers/jobsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/company/:companyId", listJobsForCompany);

module.exports = router;

const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const realJobsService = require("../services/realJobsService");

const listJobsForCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  // Ownership check: the company must belong to the requesting user.
  const company = await db.query("SELECT id FROM companies WHERE id = $1 AND user_id = $2", [
    companyId,
    req.user.id,
  ]);
  if (company.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Company not found." });
  }

  const result = await db.query(
    "SELECT * FROM jobs WHERE company_id = $1 AND user_id = $2 ORDER BY created_at DESC",
    [companyId, req.user.id]
  );

  res.json({ success: true, jobs: result.rows });
});

// GET /api/jobs/search - the Career page's "job openings finder". Unlike
// Find Companies (which asks an AI to guess plausible companies/roles),
// this returns only REAL, currently-live job postings pulled straight from
// a public job board, each with a genuine apply link.
const searchRealJobs = asyncHandler(async (req, res) => {
  const { query = "", location = "", remoteOnly } = req.query;

  let jobs;
  try {
    jobs = await realJobsService.fetchRealJobs({
      query: String(query || ""),
      location: String(location || ""),
      remoteOnly: remoteOnly === "true" || remoteOnly === "1",
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      code: "JOB_SEARCH_FAILED",
      message: `Couldn't fetch job openings right now: ${err.message}`,
    });
  }

  res.json({
    success: true,
    jobs,
    message:
      jobs.length > 0
        ? `Found ${jobs.length} real, currently open job${jobs.length === 1 ? "" : "s"}.`
        : "No matching open roles found right now. Try a different keyword or clear the location filter.",
  });
});

module.exports = { listJobsForCompany, searchRealJobs };

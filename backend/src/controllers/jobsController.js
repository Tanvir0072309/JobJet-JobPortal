const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

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

module.exports = { listJobsForCompany };

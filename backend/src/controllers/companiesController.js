const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const groqService = require("../services/groqService");
const { getCredential } = require("../utils/credentials");

// Returns companies already discovered/saved for this user.
const listCompanies = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT c.*, 
       (SELECT json_agg(j) FROM jobs j WHERE j.company_id = c.id) AS jobs,
       (SELECT json_agg(cc) FROM company_contacts cc WHERE cc.company_id = c.id) AS contacts
     FROM companies c
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, companies: result.rows });
});

// Location -> companies pipeline: instead of geocoding the location and
// querying OpenStreetMap/Overpass for nearby businesses, we now ask Groq
// directly for real companies near the given location (plus their careers
// page and a few example open roles), and save them as this user's
// companies + jobs. Contact-email lookup (Hunter/website finder) and email generation/send
// (Groq/SMTP) still happen later, lazily, in applicationsController.
const discoverCompanies = asyncHandler(async (req, res) => {
  const { location, limit, industry } = req.body;

  if (!location || typeof location !== "string" || !location.trim()) {
    return res.status(400).json({ success: false, message: "A location is required." });
  }
  const searchLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const industryFocus = ["it", "management", "any"].includes(industry) ? industry : "any";

  const groqKey = await getCredential(req.user.id, "groq");
  if (!groqKey) {
    return res.status(400).json({
      success: false,
      code: "GROQ_NOT_CONFIGURED",
      message: "Add your Groq API key in Settings first.",
    });
  }

  let found;
  try {
    found = await groqService.discoverCompanies(
      { location: location.trim(), industry: industryFocus, limit: searchLimit },
      groqKey
    );
  } catch (err) {
    return res.status(502).json({
      success: false,
      code: "DISCOVERY_FAILED",
      message: `Company search failed: ${err.message}`,
    });
  }

  if (found.length === 0) {
    return res.json({
      success: true,
      inserted: 0,
      message: `Groq couldn't confidently name any companies near "${location.trim()}". Try a bigger city nearby, a different industry filter, or a larger limit.`,
    });
  }

  let inserted = 0;
  for (const company of found) {
    const result = await db.query(
      `INSERT INTO companies (user_id, name, location, website, industry, work_mode, career_page_url, source, career_details_extracted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (user_id, name, website) DO UPDATE SET
         career_page_url = EXCLUDED.career_page_url,
         work_mode = EXCLUDED.work_mode,
         career_details_extracted = true,
         updated_at = now()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        req.user.id,
        company.name,
        location.trim(),
        company.website,
        company.industry,
        company.work_mode,
        company.career_page_url,
        company.source,
      ]
    );

    const companyId = result.rows[0]?.id;
    if (result.rows[0]?.is_new) inserted += 1;

    if (companyId && company.jobs?.length) {
      // Replace any previously-saved Groq-sourced roles for this company
      // with the fresh batch, so re-searching doesn't pile up stale ones.
      await db.query("DELETE FROM jobs WHERE company_id = $1 AND source = 'groq'", [companyId]);
      for (const job of company.jobs) {
        await db.query(
          `INSERT INTO jobs (company_id, user_id, title, location, work_mode, description, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'groq')`,
          [companyId, req.user.id, job.title, location.trim(), job.work_mode, job.description]
        );
      }
    }
  }

  res.json({
    success: true,
    inserted,
    found: found.length,
    message: `Groq found ${found.length} compan${found.length === 1 ? "y" : "ies"} near "${location.trim()}", added ${inserted} new one${inserted === 1 ? "" : "s"}.`,
  });
});

const deleteCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    "DELETE FROM companies WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Company not found." });
  }
  res.json({ success: true, message: "Company removed." });
});

module.exports = { listCompanies, discoverCompanies, deleteCompany };

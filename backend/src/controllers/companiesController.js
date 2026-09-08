const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { getCredential } = require("../utils/credentials");
const groqService = require("../services/groqService");

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

// Location -> companies pipeline. Previously this geocoded the location
// with Nominatim and pulled nearby businesses with a website tag from
// Overpass (OpenStreetMap). It now asks Groq directly for real companies
// with a hiring presence near the given location/industry, along with a
// best-guess careers page and a handful of example open roles per company -
// all in a single Groq call. Contact-email lookup (Tomba) and application
// email generation/send (Groq again, + SMTP) still happen later, lazily, in
// applicationsController.
const discoverCompanies = asyncHandler(async (req, res) => {
  const { location, limit, industry } = req.body;

  if (!location || typeof location !== "string") {
    return res.status(400).json({ success: false, message: "A location is required." });
  }
  const searchLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const industryFocus = ["it", "management", "any"].includes(industry) ? industry : "any";
  const trimmedLocation = location.trim();

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
      { location: trimmedLocation, limit: searchLimit, industry: industryFocus },
      groqKey
    );
  } catch (err) {
    return res.status(502).json({
      success: false,
      code: "DISCOVERY_FAILED",
      message: `Company search failed: ${err.message}`,
    });
  }

  if (!found || found.length === 0) {
    return res.json({
      success: true,
      inserted: 0,
      message: `Groq didn't come back with any companies for "${trimmedLocation}". Try a bigger/nearby city, a different industry filter, or a higher limit.`,
    });
  }

  let inserted = 0;
  for (const company of found) {
    // ON CONFLICT re-upserts an existing (user, name, website) row instead
    // of skipping it, so re-running a search refreshes stale career info
    // instead of leaving it frozen at whatever Groq said the first time.
    // "(xmax = 0)" is Postgres's way of telling us whether this row was a
    // fresh INSERT (true) or an UPDATE via the conflict branch (false).
    const result = await db.query(
      `INSERT INTO companies (user_id, name, location, website, career_page_url, industry, source, career_details_extracted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, name, website) DO UPDATE SET
         location = EXCLUDED.location,
         career_page_url = EXCLUDED.career_page_url,
         industry = EXCLUDED.industry,
         career_details_extracted = EXCLUDED.career_details_extracted,
         updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        req.user.id,
        company.name,
        trimmedLocation,
        company.website || "",
        company.career_page_url,
        company.industry,
        company.source,
        company.jobs.length > 0,
      ]
    );

    const row = result.rows[0];
    if (!row) continue;
    if (row.inserted) inserted += 1;

    // Replace this company's Groq-sourced job listings with the fresh set
    // from this search, so re-searching doesn't just keep piling up stale
    // duplicates from earlier runs.
    await db.query(`DELETE FROM jobs WHERE company_id = $1 AND source = 'groq'`, [row.id]);
    for (const job of company.jobs) {
      await db.query(
        `INSERT INTO jobs (company_id, user_id, title, location, work_mode, job_url, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'groq')`,
        [row.id, req.user.id, job.title, trimmedLocation, job.work_mode, job.job_url]
      );
    }
  }

  res.json({
    success: true,
    inserted,
    found: found.length,
    message: `Groq found ${found.length} compan${found.length === 1 ? "y" : "ies"} near "${trimmedLocation}", added ${inserted} new one${inserted === 1 ? "" : "s"}.`,
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

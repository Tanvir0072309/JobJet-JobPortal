const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const overpassService = require("../services/overpassService");

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

// Location -> companies pipeline: geocode the location with Nominatim, pull
// nearby businesses with a website tag from Overpass, save them as this
// user's companies. Contact-email lookup (Tomba) and email generation/send
// (Groq/SMTP) happen later, lazily, in applicationsController - this step
// only needs to get a name + website into the companies table.
const discoverCompanies = asyncHandler(async (req, res) => {
  const { location, limit, industry, lat, lon, displayName } = req.body;

  if (!location || typeof location !== "string") {
    return res.status(400).json({ success: false, message: "A location is required." });
  }
  const searchLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const industryFocus = ["it", "management", "any"].includes(industry) ? industry : "any";

  // OSM's public geocoders (Nominatim, and its Photon fallback) commonly
  // block requests from shared hosting-provider IPs outright, independent
  // of anything about the request itself - that's what was showing up here
  // as "geocoding failed (403)". The frontend now geocodes on-device first
  // (an ordinary phone network IP, not a blocked one) and sends the
  // resulting lat/lon straight through, skipping this server-side geocode
  // step entirely. We only fall back to geocoding here ourselves - and
  // still risk the same block - when the client couldn't do it (e.g. an
  // older app build, or the on-device geocode itself failed).
  let geo;
  const hasClientGeo = typeof lat === "number" && typeof lon === "number" && !Number.isNaN(lat) && !Number.isNaN(lon);
  if (hasClientGeo) {
    geo = { lat, lon, displayName: typeof displayName === "string" && displayName ? displayName : location.trim() };
  } else {
    try {
      geo = await overpassService.geocodeLocation(location.trim());
    } catch (err) {
      return res.status(502).json({
        success: false,
        code: "GEOCODE_FAILED",
        message: `Could not look up that location right now: ${err.message}`,
      });
    }

    if (!geo) {
      return res.status(404).json({
        success: false,
        code: "LOCATION_NOT_FOUND",
        message: `Couldn't find "${location}" - try a more specific place name (e.g. add city/state).`,
      });
    }
  }

  let found;
  try {
    found = await overpassService.findNearbyCompanies({ lat: geo.lat, lon: geo.lon, limit: searchLimit, industry: industryFocus });
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
      message: `No businesses with a listed website were found near "${geo.displayName}". Try a bigger city nearby, or a larger search limit.`,
    });
  }

  let inserted = 0;
  for (const company of found) {
    const result = await db.query(
      `INSERT INTO companies (user_id, name, location, website, industry, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, name, website) DO NOTHING
       RETURNING id`,
      [req.user.id, company.name, geo.displayName, company.website, company.industry, company.source]
    );
    if (result.rows.length > 0) inserted += 1;
  }

  res.json({
    success: true,
    inserted,
    found: found.length,
    message: `Found ${found.length} compan${found.length === 1 ? "y" : "ies"} near "${geo.displayName}", added ${inserted} new one${inserted === 1 ? "" : "s"}.`,
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

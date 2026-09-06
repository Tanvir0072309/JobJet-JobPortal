const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const JSON_FIELDS = [
  "other_links",
  "skills",
  "programming_languages",
  "frameworks",
  "databases",
  "tools",
  "experience",
  "education",
  "certifications",
  "projects",
];

const EDITABLE_FIELDS = [
  "full_name",
  "phone",
  "current_location",
  "country",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "other_links",
  "headline",
  "about_me",
  "skills",
  "programming_languages",
  "frameworks",
  "databases",
  "tools",
  "experience",
  "education",
  "certifications",
  "projects",
];

const getProfile = asyncHandler(async (req, res) => {
  const result = await db.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);

  if (result.rows.length === 0) {
    // Should not happen (created at registration) but self-heal rather than 500.
    await db.query("INSERT INTO profiles (user_id) VALUES ($1)", [req.user.id]);
    return res.json({ success: true, profile: { user_id: req.user.id } });
  }

  res.json({ success: true, profile: result.rows[0] });
});

const updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      updates[field] = JSON_FIELDS.includes(field)
        ? JSON.stringify(req.body[field] ?? [])
        : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "No valid fields provided." });
  }

  const setClauses = Object.keys(updates).map((field, idx) => `${field} = $${idx + 2}`);
  const values = Object.values(updates);

  const result = await db.query(
    `UPDATE profiles SET ${setClauses.join(", ")}, updated_at = now()
     WHERE user_id = $1 RETURNING *`,
    [req.user.id, ...values]
  );

  res.json({ success: true, profile: result.rows[0] });
});

module.exports = { getProfile, updateProfile };

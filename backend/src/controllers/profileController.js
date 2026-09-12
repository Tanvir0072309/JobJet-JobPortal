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
  "interested_posts",
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
  // Job posts/roles the candidate is interested in, e.g. "Backend Developer".
  // At least 5 are required whenever this field is being set (see below).
  "interested_posts",
];

const MIN_INTERESTED_POSTS = 5;

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
  // Interested posts are how JobJet knows which resume/project-list pair to
  // attach for a given job title - at least 5 are required whenever this
  // field is included in the update, so there's always a real, minimum
  // set of career interests to match against.
  if ("interested_posts" in req.body) {
    const posts = Array.isArray(req.body.interested_posts)
      ? req.body.interested_posts.map((p) => String(p).trim()).filter(Boolean)
      : [];
    if (posts.length < MIN_INTERESTED_POSTS) {
      return res.status(400).json({
        success: false,
        message: `Add at least ${MIN_INTERESTED_POSTS} interested job posts/roles.`,
      });
    }
    req.body.interested_posts = posts;
  }

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

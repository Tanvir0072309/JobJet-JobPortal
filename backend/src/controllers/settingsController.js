const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { encrypt } = require("../utils/crypto");

// "smtp" used to live here (App Password based sending) - that system has
// been replaced entirely by Gmail OAuth (see routes/gmailRoutes.js,
// controllers/gmailController.js). Gmail connection status/tokens are
// intentionally NOT managed through this generic credentials endpoint,
// since it needs its own OAuth start/callback/disconnect flow rather than
// "paste a key and save".
const ALLOWED_PROVIDERS = ["groq", "hunter"];

// GET /api/settings/api-credentials
// Returns only whether each provider is configured + a masked hint - never the real key.
const listApiCredentials = asyncHandler(async (req, res) => {
  const result = await db.query(
    "SELECT provider, last_four, updated_at FROM api_credentials WHERE user_id = $1",
    [req.user.id]
  );

  const configured = {};
  for (const provider of ALLOWED_PROVIDERS) {
    configured[provider] = { configured: false };
  }
  for (const row of result.rows) {
    // Skip any leftover 'smtp'/'gmail' rows from before this endpoint was
    // scoped down to ALLOWED_PROVIDERS - those are surfaced via their own
    // dedicated endpoints now (deleteApiCredential below still cleans up
    // an old 'smtp' row if one exists, since DELETE isn't provider-gated).
    if (!ALLOWED_PROVIDERS.includes(row.provider)) continue;
    configured[row.provider] = {
      configured: true,
      maskedKey: `••••••••${row.last_four || ""}`,
      updatedAt: row.updated_at,
    };
  }

  res.json({ success: true, credentials: configured });
});

const saveApiCredential = asyncHandler(async (req, res) => {
  const { provider, apiKey } = req.body;

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, message: `Unsupported provider: ${provider}` });
  }

  if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return res.status(400).json({ success: false, message: "A valid API key is required." });
  }
  const secretToStore = apiKey.trim();
  const lastFour = secretToStore.slice(-4);

  const { encrypted, iv, authTag } = encrypt(secretToStore);

  await db.query(
    `INSERT INTO api_credentials (user_id, provider, encrypted_key, key_iv, key_auth_tag, last_four)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET encrypted_key = $3, key_iv = $4, key_auth_tag = $5, last_four = $6, updated_at = now()`,
    [req.user.id, provider, encrypted, iv, authTag, lastFour]
  );

  res.json({ success: true, message: `${provider} API key saved.` });
});

const deleteApiCredential = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  await db.query("DELETE FROM api_credentials WHERE user_id = $1 AND provider = $2", [
    req.user.id,
    provider,
  ]);
  res.json({ success: true, message: `${provider} API key removed.` });
});

// Registers (or clears) this device's Expo push token, used to notify the
// user when a company replies to one of their applications (see
// services/replyNotifier.js). Called from the app right after login/launch.
const savePushToken = asyncHandler(async (req, res) => {
  const { pushToken } = req.body;

  if (pushToken !== null && (typeof pushToken !== "string" || pushToken.trim().length === 0)) {
    return res.status(400).json({ success: false, message: "A valid pushToken (or null to clear) is required." });
  }

  await db.query("UPDATE users SET push_token = $1, updated_at = now() WHERE id = $2", [
    pushToken,
    req.user.id,
  ]);

  res.json({ success: true, message: pushToken ? "Push token saved." : "Push token cleared." });
});

const getApplicationSettings = asyncHandler(async (req, res) => {
  const result = await db.query(
    "SELECT * FROM application_settings WHERE user_id = $1",
    [req.user.id]
  );
  res.json({ success: true, settings: result.rows[0] || null });
});

const updateApplicationSettings = asyncHandler(async (req, res) => {
  const fields = [
    "default_company_search_limit",
    "default_location",
    "remote_preference",
    "preferred_job_types",
    "default_document_ids",
    "email_signature",
    "application_tone",
  ];
  const jsonFields = ["preferred_job_types", "default_document_ids"];

  const updates = {};
  for (const field of fields) {
    if (field in req.body) {
      updates[field] = jsonFields.includes(field)
        ? JSON.stringify(req.body[field] ?? [])
        : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "No valid settings provided." });
  }

  const setClauses = Object.keys(updates).map((field, idx) => `${field} = $${idx + 2}`);
  const values = Object.values(updates);

  const result = await db.query(
    `UPDATE application_settings SET ${setClauses.join(", ")}, updated_at = now()
     WHERE user_id = $1 RETURNING *`,
    [req.user.id, ...values]
  );

  res.json({ success: true, settings: result.rows[0] });
});

module.exports = {
  listApiCredentials,
  saveApiCredential,
  deleteApiCredential,
  savePushToken,
  getApplicationSettings,
  updateApplicationSettings,
};

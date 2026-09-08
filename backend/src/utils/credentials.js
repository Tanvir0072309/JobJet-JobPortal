const db = require("../config/db");
const { decrypt } = require("./crypto");

// Returns the decrypted secret string for a provider ('groq' | 'tomba' | 'smtp'),
// or null if the user hasn't configured it yet. For 'smtp' and 'tomba' this
// is a JSON string (JSON.parse it before use).
async function getCredential(userId, provider) {
  const result = await db.query(
    "SELECT encrypted_key, key_iv, key_auth_tag FROM api_credentials WHERE user_id = $1 AND provider = $2",
    [userId, provider]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return decrypt({ encrypted: row.encrypted_key, iv: row.key_iv, authTag: row.key_auth_tag });
}

module.exports = { getCredential };

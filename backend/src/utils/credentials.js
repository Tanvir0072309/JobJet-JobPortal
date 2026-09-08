const db = require("../config/db");
const { decrypt } = require("./crypto");

// Returns the decrypted secret string for a provider ('groq' | 'hunter' | 'smtp'),
// or null if the user hasn't configured it yet. For 'smtp' this is a JSON
// string (JSON.parse it before use).
//
// AES-256-GCM throws the raw Node/OpenSSL error "Unsupported state or
// unable to authenticate data" whenever the stored auth tag can't be
// verified - almost always because ENCRYPTION_KEY changed (redeploy with a
// new/rotated key) after the row was saved, not because anything about how
// the credential was stored is "wrong". Left unhandled, that raw message
// bubbles straight up to the app as a confusing 500. Instead: treat it as
// "this saved credential is unreadable", remove the stale row so the user
// isn't stuck in a broken state, and surface one clear, actionable message.
async function getCredential(userId, provider) {
  const result = await db.query(
    "SELECT encrypted_key, key_iv, key_auth_tag FROM api_credentials WHERE user_id = $1 AND provider = $2",
    [userId, provider]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  try {
    return decrypt({ encrypted: row.encrypted_key, iv: row.key_iv, authTag: row.key_auth_tag });
  } catch (err) {
    await db
      .query("DELETE FROM api_credentials WHERE user_id = $1 AND provider = $2", [userId, provider])
      .catch(() => {});

    const friendly = new Error(
      `Your saved ${provider === "smtp" ? "sending email" : provider} credentials could not be read and were reset - please re-enter them in Settings.`
    );
    friendly.status = 400;
    friendly.code = "CREDENTIAL_UNREADABLE";
    throw friendly;
  }
}

module.exports = { getCredential };

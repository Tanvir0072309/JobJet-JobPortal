// Gmail sending, over plain HTTPS (users.messages.send) - no SMTP, no
// Nodemailer, nothing that needs an outbound SMTP port, so this works fine
// on Render's free tier. Uses Node's built-in fetch (Node 18+) rather than
// pulling in googleapis/google-auth-library, since all we need is a handful
// of REST calls.
//
// Scope: https://www.googleapis.com/auth/gmail.send ONLY. Every call this
// file makes (authorize, token exchange/refresh, users.getProfile,
// users.messages.send) is valid under that single scope - nothing here
// ever requests or relies on gmail.readonly/modify/mail.google.com/compose.
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const db = require("../config/db");
const env = require("../config/env");
const { encrypt, decrypt } = require("../utils/crypto");

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const PROFILE_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

// ---------------------------------------------------------------------------
// OAuth: authorization URL + state token
// ---------------------------------------------------------------------------

// The "state" param round-trips through Google unmodified, so we use it to
// carry (a) which JobJet user started this flow and (b) a short expiry -
// signed with the same server-only secret used for JWTs, so it can't be
// forged into authorizing on someone else's behalf. This avoids needing a
// separate oauth_states table.
function createState(userId) {
  const payload = JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", env.jwtSecret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifyState(state) {
  if (typeof state !== "string" || !state.includes(".")) return null;
  const [payloadB64, signature] = state.split(".");
  const expectedSignature = crypto.createHmac("sha256", env.jwtSecret).update(payloadB64).digest("base64url");

  const sigBuf = Buffer.from(signature || "");
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload.userId || !payload.exp || payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

function buildAuthUrl(userId) {
  const state = createState(userId);
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // forces a refresh_token even on a re-connect
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange / refresh
// ---------------------------------------------------------------------------

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleRedirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Never log the raw response - it can contain nothing secret at this
    // point (no token issued yet on failure) but keep the habit consistent.
    const err = new Error(data.error_description || data.error || "Google rejected the authorization code.");
    err.status = 400;
    err.code = "GOOGLE_TOKEN_EXCHANGE_FAILED";
    throw err;
  }

  return data; // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error_description || data.error || "Could not refresh the Gmail connection.");
    err.status = 400;
    // A caller can use this to know the refresh_token itself is dead
    // (e.g. user revoked access from their Google Account) and that the
    // user needs to reconnect, rather than treating it as transient.
    err.code = data.error === "invalid_grant" ? "GMAIL_REAUTH_REQUIRED" : "GOOGLE_TOKEN_REFRESH_FAILED";
    throw err;
  }

  return data; // { access_token, expires_in, scope, token_type } - no new refresh_token
}

// ---------------------------------------------------------------------------
// Stored credential helpers (encrypted at rest, reusing utils/crypto.js -
// same AES-256-GCM approach as every other per-user secret in this app)
// ---------------------------------------------------------------------------

async function getStoredCredential(userId) {
  const result = await db.query(
    "SELECT encrypted_key, key_iv, key_auth_tag FROM api_credentials WHERE user_id = $1 AND provider = 'gmail'",
    [userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  try {
    return JSON.parse(decrypt({ encrypted: row.encrypted_key, iv: row.key_iv, authTag: row.key_auth_tag }));
  } catch {
    // Unreadable (e.g. ENCRYPTION_KEY rotated) - treat as disconnected
    // rather than crashing the send; the user will need to reconnect.
    return null;
  }
}

async function storeCredential(userId, { refreshToken, accessToken, expiresAt }) {
  const secret = JSON.stringify({ refreshToken, accessToken, expiresAt });
  const { encrypted, iv, authTag } = encrypt(secret);

  await db.query(
    `INSERT INTO api_credentials (user_id, provider, encrypted_key, key_iv, key_auth_tag, last_four)
     VALUES ($1, 'gmail', $2, $3, $4, NULL)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET encrypted_key = $2, key_iv = $3, key_auth_tag = $4, updated_at = now()`,
    [userId, encrypted, iv, authTag]
  );
}

// Returns a currently-valid access token for this user, refreshing it first
// if it's expired (or about to expire) - callers never see/handle raw
// tokens or expiry math themselves.
async function getValidAccessToken(userId) {
  const stored = await getStoredCredential(userId);
  if (!stored || !stored.refreshToken) {
    const err = new Error("Gmail isn't connected for this account.");
    err.status = 400;
    err.code = "GMAIL_NOT_CONNECTED";
    throw err;
  }

  const isExpired = !stored.expiresAt || Date.now() > stored.expiresAt - 60 * 1000; // 60s safety margin
  if (!isExpired) return stored.accessToken;

  const refreshed = await refreshAccessToken(stored.refreshToken);
  const expiresAt = Date.now() + refreshed.expires_in * 1000;
  await storeCredential(userId, { refreshToken: stored.refreshToken, accessToken: refreshed.access_token, expiresAt });
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

// Completes the OAuth callback: exchanges the code, stores the encrypted
// refresh token, and marks the user's Gmail connection as active. Returns
// the connected Gmail address for display in the UI.
async function completeConnection(userId, code) {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on first consent (or with
    // prompt=consent, which we always pass) - if it's still missing here
    // something is off with the client config, so fail loudly instead of
    // silently storing a connection that will die in an hour.
    const err = new Error(
      "Google didn't return a refresh token. Please try connecting Gmail again."
    );
    err.status = 400;
    err.code = "GMAIL_NO_REFRESH_TOKEN";
    throw err;
  }

  const expiresAt = Date.now() + tokens.expires_in * 1000;
  await storeCredential(userId, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt,
  });

  // users.getProfile only needs gmail.send scope for the caller's own
  // mailbox metadata (address, message/thread counts) - it does not read
  // any mail content, so this stays within the single scope we requested.
  const profileRes = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json().catch(() => ({}));
  const gmailEmail = profileRes.ok ? profile.emailAddress : null;

  await db.query("UPDATE users SET gmail_connected = true, gmail_email = $1, updated_at = now() WHERE id = $2", [
    gmailEmail,
    userId,
  ]);

  return { gmailEmail };
}

async function disconnect(userId) {
  const stored = await getStoredCredential(userId);

  // Best-effort revoke with Google - if it fails (already revoked, network
  // blip) we still remove our own copy, since that's what actually matters
  // for "is this user's Gmail still connected to JobJet".
  if (stored?.refreshToken) {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(stored.refreshToken)}`, { method: "POST" }).catch(
      () => {}
    );
  }

  await db.query("DELETE FROM api_credentials WHERE user_id = $1 AND provider = 'gmail'", [userId]);
  await db.query("UPDATE users SET gmail_connected = false, gmail_email = NULL, updated_at = now() WHERE id = $1", [
    userId,
  ]);
}

// ---------------------------------------------------------------------------
// MIME construction
// ---------------------------------------------------------------------------

function encodeHeaderWord(text) {
  // Subjects/names with non-ASCII characters need RFC 2047 encoding; plain
  // ASCII is left untouched for readability in raw form.
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// documents: rows from the `documents` table (needs .name, .file_path, .file_type).
async function buildMimeMessage({ fromEmail, fromName, to, subject, body, documents = [] }) {
  const boundary = `jobjet_${crypto.randomBytes(16).toString("hex")}`;
  const fromHeader = fromEmail ? (fromName ? `${encodeHeaderWord(fromName)} <${fromEmail}>` : fromEmail) : undefined;

  const headers = [
    `To: ${to}`,
    ...(fromHeader ? [`From: ${fromHeader}`] : []),
    `Subject: ${encodeHeaderWord(subject || "(no subject)")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const textPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body || "", "utf8").toString("base64"),
  ].join("\r\n");

  const attachmentParts = await Promise.all(
    documents.map(async (doc) => {
      const fileBuffer = await fs.readFile(doc.file_path);
      const mimeType = doc.file_type || "application/octet-stream";
      const filename = doc.name || path.basename(doc.file_path);
      return [
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
        "",
        fileBuffer.toString("base64").replace(/(.{76})/g, "$1\r\n"),
      ].join("\r\n");
    })
  );

  const raw = [headers.join("\r\n"), "", textPart, ...attachmentParts, `--${boundary}--`, ""].join("\r\n");
  return base64UrlEncode(Buffer.from(raw, "utf8"));
}

// ---------------------------------------------------------------------------
// Sending, with basic retry/backoff for Gmail rate limits/transient errors
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRaw(accessToken, raw, { attempt = 1 } = {}) {
  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (res.ok) return res.json();

  const data = await res.json().catch(() => ({}));
  const status = res.status;

  // Gmail rate-limit / transient errors - back off and retry a couple of
  // times rather than failing the whole batch send immediately.
  const isRetryable = status === 429 || status >= 500;
  if (isRetryable && attempt < 3) {
    await sleep(attempt * 1000);
    return sendRaw(accessToken, raw, { attempt: attempt + 1 });
  }

  const message = data?.error?.message || "Gmail rejected the message.";
  const err = new Error(
    status === 429
      ? "Gmail's sending limit was hit - please wait a bit and try again."
      : `Couldn't send the email: ${message}`
  );
  // Preserve 401 as-is so sendApplicationEmail() can tell "access token
  // expired mid-flight" apart from a genuine bad request, and retry once
  // after a forced refresh instead of surfacing a confusing failure.
  err.status = status === 401 ? 401 : status === 429 ? 429 : 400;
  err.code = status === 401 ? "GMAIL_TOKEN_EXPIRED" : status === 429 ? "GMAIL_RATE_LIMITED" : "GMAIL_SEND_FAILED";
  throw err;
}

// Public entry point used by applicationsController.js - mirrors the old
// mailerService.sendApplicationEmail(...) signature closely so the calling
// code changes minimally.
async function sendApplicationEmail({ userId, to, subject, body, documents = [] }) {
  let accessToken = await getValidAccessToken(userId);

  const userRow = await db.query("SELECT gmail_email FROM users WHERE id = $1", [userId]);
  const fromEmail = userRow.rows[0]?.gmail_email || undefined;

  const raw = await buildMimeMessage({ fromEmail, to, subject, body, documents });

  try {
    return await sendRaw(accessToken, raw);
  } catch (err) {
    // A 401 here (expired/invalid access token slipping past our own
    // expiry check, e.g. clock drift) gets exactly one retry after a
    // forced refresh - never a silent infinite loop.
    if (err.status === 401) {
      const stored = await getStoredCredential(userId);
      if (stored?.refreshToken) {
        const refreshed = await refreshAccessToken(stored.refreshToken);
        const expiresAt = Date.now() + refreshed.expires_in * 1000;
        await storeCredential(userId, {
          refreshToken: stored.refreshToken,
          accessToken: refreshed.access_token,
          expiresAt,
        });
        return sendRaw(refreshed.access_token, raw);
      }
    }
    throw err;
  }
}

module.exports = {
  buildAuthUrl,
  verifyState,
  completeConnection,
  disconnect,
  getValidAccessToken,
  sendApplicationEmail,
};

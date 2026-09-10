const db = require("../config/db");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const gmailService = require("../services/gmailService");

// POST /api/gmail/oauth/start (authenticated)
// Returns the Google consent URL for this user to open in an in-app browser
// (WebBrowser.openAuthSessionAsync on the frontend). No secrets in the
// response - just a URL built from the public client_id.
const startOAuth = asyncHandler(async (req, res) => {
  const authUrl = gmailService.buildAuthUrl(req.user.id);
  res.json({ success: true, authUrl });
});

// GET /api/gmail/oauth/callback (PUBLIC - Google redirects here directly,
// with no JobJet session/JWT available; req.user does not exist on this
// route. The signed `state` param is what ties this back to a JobJet user -
// see gmailService.createState/verifyState). Always ends by 302-redirecting
// into the app via its existing jobjet:// scheme, never by rendering JSON,
// since the far end of this redirect is a mobile in-app browser, not an API
// client.
const oauthCallback = asyncHandler(async (req, res) => {
  const { code, state, error: googleError } = req.query;
  const appRedirect = env.gmailOauthAppRedirect;

  const redirectWithStatus = (status, reason) => {
    const url = new URL(appRedirect);
    url.searchParams.set("status", status);
    if (reason) url.searchParams.set("reason", reason);
    return res.redirect(url.toString());
  };

  if (googleError) {
    // e.g. the user tapped "Cancel" on Google's consent screen.
    return redirectWithStatus("error", googleError === "access_denied" ? "cancelled" : "google_error");
  }

  const userId = gmailService.verifyState(state);
  if (!userId || !code) {
    return redirectWithStatus("error", "invalid_state");
  }

  try {
    await gmailService.completeConnection(userId, code);
    return redirectWithStatus("success");
  } catch (err) {
    // Never leak Google's raw OAuth error text into the redirect URL/UI -
    // just enough of a code for the app to show a generic, safe message.
    console.error(`Gmail OAuth callback failed for user ${userId}:`, err.message);
    return redirectWithStatus("error", "connection_failed");
  }
});

// GET /api/gmail/status (authenticated)
const getStatus = asyncHandler(async (req, res) => {
  const result = await db.query("SELECT gmail_connected, gmail_email FROM users WHERE id = $1", [req.user.id]);
  const row = result.rows[0] || { gmail_connected: false, gmail_email: null };
  res.json({ success: true, connected: row.gmail_connected, email: row.gmail_email });
});

// POST /api/gmail/disconnect (authenticated)
const disconnect = asyncHandler(async (req, res) => {
  await gmailService.disconnect(req.user.id);
  res.json({ success: true, message: "Gmail disconnected." });
});

module.exports = { startOAuth, oauthCallback, getStatus, disconnect };

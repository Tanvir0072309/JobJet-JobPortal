require("dotenv").config();

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  // Gmail API sending (replaces the old SMTP/App Password system) is now
  // core to the app - fail fast instead of limping along with sending broken.
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // Fail fast and clearly rather than limping along with undefined secrets.
  console.error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
      "Copy backend/.env.example to backend/.env and fill these in."
  );
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  encryptionKey: process.env.ENCRYPTION_KEY,
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : "*",

  // Gmail OAuth (Web application client - holds the secret, used for the
  // server-side authorization-code exchange; see gmailService.js).
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Must exactly match an "Authorized redirect URI" on that Web client in
  // Google Cloud Console, e.g. https://your-app.onrender.com/api/gmail/oauth/callback
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,

  // Deep link the backend redirects the in-app browser to once the OAuth
  // callback finishes (success or failure), so WebBrowser.openAuthSessionAsync
  // on the client closes and returns control to the app. Uses the app's
  // existing "jobjet" scheme (app.json) - no new scheme/deep link needed.
  gmailOauthAppRedirect: process.env.GMAIL_OAUTH_APP_REDIRECT || "jobjet://gmail-callback",

  // Server-side, per-user daily cap on outbound application emails -
  // configurable so it can be tuned without a code change as the user base
  // grows. Enforced from applications.sent_at (see applicationsController.js),
  // not from anything the client sends, so it can't be bypassed client-side.
  dailyEmailLimitPerUser: Number(process.env.DAILY_EMAIL_LIMIT_PER_USER) || 100,
};

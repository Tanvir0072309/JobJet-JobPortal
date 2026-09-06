const bcrypt = require("bcrypt");
const db = require("../config/db");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { signAccessToken, generateResetToken, hashResetToken } = require("../utils/token");

const SALT_ROUNDS = 12;

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "A valid email and a password of at least 8 characters are required.",
    });
  }

  const existing = await db.query("SELECT id FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const userResult = await db.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email.toLowerCase(), passwordHash]
  );
  const user = userResult.rows[0];

  // Create empty profile + default settings row so downstream features never
  // have to special-case "profile doesn't exist yet".
  await db.query("INSERT INTO profiles (user_id) VALUES ($1)", [user.id]);
  await db.query("INSERT INTO application_settings (user_id) VALUES ($1)", [user.id]);

  const token = signAccessToken(user);

  res.status(201).json({
    success: true,
    token,
    user: { id: user.id, email: user.email },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  const result = await db.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Same generic message whether the email doesn't exist or the password is
  // wrong, so we don't leak which accounts exist.
  const genericError = { success: false, message: "Invalid email or password." };
  if (!user) return res.status(401).json(genericError);

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) return res.status(401).json(genericError);

  const token = signAccessToken(user);

  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email },
  });
});

// Logout is stateless (JWT, no server session/refresh token to revoke).
// The client simply discards the token. This endpoint exists for a
// consistent API surface and future extension (e.g. token blacklisting).
const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: "Logged out." });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "A valid email is required." });
  }

  const result = await db.query("SELECT id FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  const user = result.rows[0];

  // Always respond the same way to avoid leaking whether an email is registered.
  const responseBody = {
    success: true,
    message: "If an account exists for this email, a reset link has been generated.",
  };

  if (!user) return res.json(responseBody);

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  // No email-sending service is wired up yet (that's a later integration).
  // In development, return the raw token directly so the flow is testable end to end.
  if (env.nodeEnv === "development") {
    responseBody.devResetToken = rawToken;
  }

  res.json(responseBody);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (typeof token !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "A reset token and a new password of at least 8 characters are required.",
    });
  }

  const tokenHash = hashResetToken(token);
  const result = await db.query(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  const resetRow = result.rows[0];

  if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at) < new Date()) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or has expired." });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    resetRow.user_id,
  ]);
  await db.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [
    resetRow.id,
  ]);

  res.json({ success: true, message: "Password updated. You can now log in." });
});

module.exports = { register, login, logout, forgotPassword, resetPassword };

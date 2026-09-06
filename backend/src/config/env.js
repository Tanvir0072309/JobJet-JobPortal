require("dotenv").config();

const required = ["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"];

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
};

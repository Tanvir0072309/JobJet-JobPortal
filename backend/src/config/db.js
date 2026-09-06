const { Pool } = require("pg");
const env = require("./env");

// Single source of truth for DB connectivity. Never hardcode credentials here -
// everything comes from DATABASE_URL so swapping local Postgres for Render
// later is a one-line env change.
const pool = new Pool({
  connectionString: env.databaseUrl,
  // Render's managed Postgres requires SSL; local Postgres does not.
  // This keeps both working without code changes.
  ssl: env.databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function checkConnection() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Postgres connection check failed:", err.message);
    return false;
  }
}

module.exports = { pool, query, getClient, checkConnection };

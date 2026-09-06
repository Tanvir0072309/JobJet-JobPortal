const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { pool } = require("../config/db");

async function migrate() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log(`Applying schema to: ${env.databaseUrl.replace(/:[^:@]*@/, ":****@")}`);

  try {
    await pool.query(sql);
    console.log("Migration complete. All tables are up to date.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();

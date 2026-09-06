# JobJet Backend

## Setup (local development)

1. Install dependencies:
   ```
   npm install
   ```

2. Create your local Postgres database:
   ```
   createdb jobjet
   ```

3. Copy the env file and fill in secrets:
   ```
   cp .env.example .env
   ```
   - `DATABASE_URL` should point at your local Postgres (default in `.env.example` works with a standard local install).
   - `JWT_SECRET`: any long random string.
   - `ENCRYPTION_KEY`: generate with:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

4. Run the migration to create all tables:
   ```
   npm run migrate
   ```

5. Start the server:
   ```
   npm run dev
   ```

6. Verify it's alive:
   ```
   curl http://localhost:5000/health
   ```
   should return `{"success":true,"database":"connected"}`.

## Notes

- Switching to Render Postgres later is just replacing `DATABASE_URL` in `.env` — no code changes needed.
- Company discovery, AI email generation, email sending, and reply ingestion are intentionally stubbed (they return a clear `501` with a `code` field) — these are the next build phase, not part of this foundation.
- Per-user Groq/Hunter API keys are encrypted at rest (AES-256-GCM) and never returned in full via the API.

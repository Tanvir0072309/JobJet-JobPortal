# JobJet

A job-application assistant app: React Native (Expo Router, SDK 57) frontend + Node/Express + Postgres backend.

```
jobjet-updated/
├── frontend/   Expo app (runs in Expo Go)
└── backend/    Express API + Postgres
```

## What was fixed in this pass

- **`profile.tsx`**: the "chevron" icon on Settings/Logout rows was guarded by `onPress && !danger`, but `onPress` is a required prop that's always truthy — so the condition (correctly flagged by TypeScript) could never be false the way it looked. Fixed to just check `!danger`.
- **Verified end-to-end**: `tsc --noEmit` (0 errors), `expo export` (all 21 routes bundle cleanly), and `expo-doctor` (19/19 relevant checks pass) — no missing components, no broken imports, no dangling function calls anywhere in the frontend.
- **Backend**: every route file, controller, service, and util was syntax-checked and boots cleanly (`node server.js`) with a placeholder `.env`.
- **Logo/splash**: already wired correctly — `app.json` points the app icon, Android adaptive icon, **and** splash screen at your actual JobJet plane logo (`assets/images/jobjet-logo.png` / `splash-icon.png`), white background. Your logo is what appears first when the app launches — nothing needed changing here.

### Company discovery — implemented, and now industry-aware
`POST /api/companies/discover` does the real pipeline:

1. **Geocode** the location text you type (e.g. "Ahmedabad, Gujarat") using **Nominatim** (OpenStreetMap's free geocoder) — no API key needed.
2. **Search nearby businesses** with **Overpass API** (also free, no key). The Find Companies screen now has a **"Kind of company"** selector — **IT / Software**, **Management / Business**, or **Any** — which changes what OSM tags are searched (`office=it` / `coworking` / `telecommunication` / `research` for IT; `office=company` / `consulting` / `financial` / `estate_agent` / `government` for management). It defaults to **IT / Software** automatically if your profile has programming languages or frameworks listed, otherwise **Any** — you can always change it before searching.
3. **Save** each new company (name + website + industry + location) into your `companies` table, deduplicated so re-searching the same area won't create duplicates.
4. From there: tapping **Apply** on selected companies calls **Hunter.io** (only if you haven't already found a contact for that company) to get a real contact email from the website's domain, then **Groq** writes a personalized email, then it's sent through your configured **SMTP** account.

Notes:
- Both Nominatim and Overpass are shared public services with fair-use limits — fine for personal use, but don't hammer them with rapid repeated searches.
- OpenStreetMap's data density varies a lot by area — expect strong results in big cities (Ahmedabad, Mumbai, Bengaluru, etc.) and possibly zero results in smaller towns. That's a data-coverage limit, not a bug.
- I wrote this against the documented Overpass/Nominatim APIs but couldn't make live test calls to them from this environment (network-restricted sandbox) — please test a real search once you run it locally, and tell me if anything comes back wrong (`backend/src/services/overpassService.js` is the file to check first).

### Reply tracking — now implemented via IMAP
The Emails tab now has a **"Check for replies"** button (and pull-to-refresh) that:

1. Connects to your **own inbox** over IMAP, using the same email + app password you already saved for sending (Settings → Sending Email).
2. Auto-detects the IMAP host/port for Gmail, Outlook/Hotmail, Yahoo, iCloud, and Zoho. If you use a different provider, fill in the optional **"IMAP host"** (and port, default 993) fields in Settings.
3. Looks only at messages **from addresses you've actually applied to** in the last 30 days — nothing else in your inbox is touched or read.
4. Saves new replies into `email_messages`, marks the application `has_unread_reply = true` and its status `replied` (without overriding a status you've already moved forward manually, like `interview`), so they show up in the Emails tab and the Applications summary immediately.
5. Safe to run repeatedly — a database-level unique constraint on the email's Message-ID stops the same reply being recorded twice.

Requirements: your SMTP account must be saved in Settings first (the error message will say so if it's missing), and your email provider must allow IMAP access with an app password (Gmail/Yahoo do this by default once you create an app password; regular Gmail passwords won't work — same requirement as sending).

Like discovery, I couldn't make a live IMAP connection from this sandboxed environment to test end-to-end — the code follows `imapflow`'s documented API (a well-established library), but please try a real "Check for replies" once you're running the backend and tell me what you see if something looks off (`backend/src/services/imapService.js`).

---

## Running the frontend in Expo Go (SDK 57)

Your Expo Go app is on SDK 57.0.9, and this project uses Expo SDK `~57.0.20` — same major SDK, so it's compatible.

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Connecting to the backend from your phone
By default the app calls `http://localhost:5000` (or `http://10.0.2.2:5000` on an Android emulator). A **physical phone in Expo Go cannot reach your computer's `localhost`** — you must point it at your computer's LAN IP:

1. Find your computer's local IP (e.g. `192.168.1.20`) — Windows: `ipconfig`, Mac/Linux: `ifconfig` or `ip a`.
2. In `frontend/`, create a `.env` file:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:5000
   ```
3. Make sure your phone and computer are on the **same Wi-Fi network**, then restart `npx expo start`.
4. If it still can't connect, your computer's firewall may be blocking port 5000 — allow inbound connections to it, or run `npx expo start --tunnel` as a fallback (slower, but works across networks).

If you don't set this and just want to try the UI without a live backend, the app will still load and navigate — API calls will fail with a clear "Could not reach the JobJet server" message instead of crashing.

---

## Running the backend

Requires Node.js and a Postgres database (local or hosted, e.g. Render/Supabase).

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — your Postgres connection string.
- `JWT_SECRET` — any long random string.
- `ENCRYPTION_KEY` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `CORS_ORIGIN` — leave as-is for local dev.

Then create the database and run migrations:

```bash
createdb jobjet          # or create it however your Postgres host expects
npm run migrate
npm run dev
```

Check it's alive:

```bash
curl http://localhost:5000/health
# {"success":true,"database":"connected"}
```

### Feature API keys (set from inside the app, under Settings — not in `.env`)
- **Groq API key** — powers AI-generated application emails.
- **Hunter.io API key** — finds a company's contact email from its domain.
- **SMTP credentials** (e.g. a Gmail app password) — used to actually send the application emails.

These are per-user, encrypted at rest with `ENCRYPTION_KEY`, and entered from the Settings screen in the app — the app will tell you clearly (with a `..._NOT_CONFIGURED` message) if you try to use a feature before adding the relevant key.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not reach the JobJet server" on phone | Set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (see above), not `localhost`. |
| Backend logs "Could not connect to Postgres" | Check `DATABASE_URL` in `backend/.env`, confirm Postgres is running and reachable. |
| Metro/Expo cache acting weird after pulling changes | `npx expo start -c` (clears bundler cache). |
| "Missing required environment variables" on backend start | You haven't copied `.env.example` to `.env` yet, or left a placeholder blank. |
# JobJet-JobPortal

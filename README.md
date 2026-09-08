<div align="center">

<img src="https://res.cloudinary.com/dat8orrws/image/upload/v1788690254/Gemini_Generated_Image_mc57kzmc57kzmc57.png" alt="JobJet" width="120" style="border-radius: 28px;" />

<h1>JobJet</h1>

<h3>Your job hunt, on autopilot.</h3>

<p><i>Find companies near any location, land a real contact email, let AI write the pitch, hit send — track the replies from your pocket.</i></p>

<br/>

<a href="https://expo.dev/artifacts/eas/f0521d5f-rA223ahKaXWT80NbGWByWhm07K_u2uoNGA.aab">
  <img src="https://img.shields.io/badge/⚡%20DOWNLOAD%20FOR%20ANDROID-Tap%20to%20get%20the%20APK-0B0F13?style=for-the-badge&logo=android&logoColor=3DDC84&labelColor=0B0F13" alt="Download APK" height="52"/>
</a>

<br/><br/>

<img src="https://img.shields.io/badge/API-Live_on_Render-46E3B7?style=flat-square&logo=render&logoColor=white" />
<img src="https://img.shields.io/badge/Database-Neon.tech-00E599?style=flat-square&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Mobile-Expo_React_Native-000020?style=flat-square&logo=expo&logoColor=white" />
<img src="https://img.shields.io/badge/Server-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/AI-Groq-F55036?style=flat-square" />
<img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />

</div>

<br/>

<p align="center">
  <img src="https://user-images.githubusercontent.com/placeholder/divider.svg" width="0" height="0" />
</p>

<div align="center">

```
  📍  location   →   🏢  discover   →   📇  contact   →   ✍️  AI draft   →   📤  send   →   📥  track
```

</div>

<br/>

## What is this, actually?

Job hunting is 10% writing a good application and 90% mind-numbing repetition — searching for companies, hunting for *someone's* email address, tweaking the same cover letter for the hundredth time, and refreshing your inbox hoping for a reply.

**JobJet swallows that whole loop.** Tell it a city. It finds real companies there, finds a real person to email, writes a real application in your voice, sends it, and watches your inbox so you don't have to.

It's a full-stack, self-hosted, bring-your-own-API-keys project — nothing about it depends on a paid backend you don't control.

<br/>

## How it flows

<table>
<tr>
<td width="60">📍</td>
<td><b>Drop a pin</b><br/><sub>Type any city or area. JobJet geocodes it and scans OpenStreetMap for nearby companies that actually have a public website — no fake data, no scraped lead lists.</sub></td>
</tr>
<tr>
<td>📇</td>
<td><b>Find the human</b><br/><sub>For each company, Tomba.io resolves a real, verifiable contact email — not just a generic <code>info@</code> address.</sub></td>
</tr>
<tr>
<td>✍️</td>
<td><b>AI writes the pitch</b><br/><sub>Groq's LLM drafts a personalized application using your profile, resume, and that specific company's details. Every email reads like you wrote it.</sub></td>
</tr>
<tr>
<td>📤</td>
<td><b>You send it, from you</b><br/><sub>Delivered through your own Gmail/Outlook SMTP — never a shared sending server, so nothing ever lands in spam because of someone else's reputation.</sub></td>
</tr>
<tr>
<td>📥</td>
<td><b>Replies, tracked automatically</b><br/><sub>IMAP quietly checks for responses and updates your pipeline — sent, replied, interviewing, rejected — so your dashboard is always current.</sub></td>
</tr>
</table>

<br/>

## Why it's built this way

<table>
<tr><td>🔐</td><td><b>Your keys, your data</b></td><td>Groq, Tomba, and SMTP are all <i>your</i> free-tier credentials, encrypted at rest with AES-256-GCM. Nobody's routing your applications through a shared black box.</td></tr>
<tr><td>🌍</td><td><b>Zero-cost discovery</b></td><td>Company search runs on OpenStreetMap's free Nominatim + Overpass infrastructure — no maps API bill, ever.</td></tr>
<tr><td>📎</td><td><b>One place for your documents</b></td><td>Resume, cover letter, portfolio — upload once, JobJet attaches the right ones automatically.</td></tr>
<tr><td>📊</td><td><b>A pipeline, not a spreadsheet</b></td><td>Every application's status lives in one dashboard instead of a dozen browser tabs and a mental to-do list.</td></tr>
</table>

<br/>

## Under the hood

<table>
<tr>
<th align="left">Layer</th>
<th align="left">Stack</th>
</tr>
<tr>
<td><b>Mobile app</b></td>
<td>React Native · Expo SDK 57 · Expo Router · TypeScript · <code>expo-secure-store</code> for on-device session storage · EAS Build for production APK/AAB</td>
</tr>
<tr>
<td><b>API</b></td>
<td>Node.js · Express 5 · PostgreSQL (Neon) · JWT auth · AES-256-GCM encrypted credential vault · Multer · Nodemailer · ImapFlow · hosted on Render</td>
</tr>
<tr>
<td><b>Integrations</b></td>
<td><a href="https://groq.com">Groq</a> for AI writing · <a href="https://tomba.io">Tomba.io</a> for contact lookup · OpenStreetMap for location intelligence — all bring-your-own-key</td>
</tr>
</table>

<br/>

## Get it on your phone

<table>
<tr>
<td width="28">1</td><td>Tap the download badge at the top of this page (or <a href="https://expo.dev/artifacts/eas/fYyjX9xytTncIm2QJ5q6dijUpML-lQ1qXgO3zXN3vaY.apk">grab the APK directly</a>).</td>
</tr>
<tr>
<td>2</td><td>Open the downloaded file. Android will ask you to allow installs from this source once — allow it.</td>
</tr>
<tr>
<td>3</td><td>Open JobJet, create an account, and drop your Groq / Tomba / SMTP keys into <b>Settings</b>.</td>
</tr>
<tr>
<td>4</td><td>Search a city under <b>Find Jobs</b> and watch your pipeline fill up.</td>
</tr>
</table>

<br/>

## Project layout

```
jobjet/
├── backend/                  Node.js + Express REST API
│   └── src/
│       ├── controllers/      Route handlers
│       ├── services/         Groq · Tomba · mailer · IMAP · OSM discovery
│       ├── middleware/       Auth guard, error handling
│       ├── db/                Schema + migrations
│       └── utils/             Crypto, JWT, credential helpers
│
└── frontend/                  Expo React Native app
    └── src/
        ├── app/                Expo Router screens
        ├── components/         Shared UI
        ├── services/           One API client per feature
        └── context/            Auth context
```

<br/>

## Running it yourself

**You'll need:** Node.js 18+, a [Neon](https://neon.tech) Postgres database (or any Postgres), and either Expo Go or an Android emulator.

```bash
git clone https://github.com/Tanvir0072309/JobJet-JobPortal.git
cd JobJet-JobPortal
```

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # fill in the values — see table below
npm run migrate            # creates/updates all tables
npm run dev                 # → http://localhost:5000
```

**Frontend**
```bash
cd ../frontend
npm install
npx expo start -c
```
Scan the QR with **Expo Go**, or press `a` for an Android emulator.

<br/>

## Environment variables

> These are *app-level* secrets for your own deployment. End users add their own Groq/Tomba/SMTP keys inside the app itself — nothing personal ever goes in here.

| Variable | What it's for |
| :-- | :-- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Long random string that signs login sessions |
| `JWT_EXPIRES_IN` | Session lifetime, e.g. `7d` |
| `ENCRYPTION_KEY` | 64-char hex string — encrypts saved API keys/SMTP passwords. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `JOBJET_CONTACT_EMAIL` | Your contact email, sent in the User-Agent to OpenStreetMap's geocoder (required by their usage policy) |
| `PORT` | API listen port (Render sets this for you) |

<br/>

## Building your own APK

Already wired for [EAS Build](https://docs.expo.dev/build/introduction/) — no Android Studio required.

```bash
npm install -g eas-cli
eas login
cd frontend
eas build --profile preview --platform android
```

`preview` builds an installable `.apk` pointed at the production API. Swap in `--profile production` for a Play Store `.aab`.

<br/>

## What's next

- [ ] iOS build via EAS
- [ ] Push notifications for new replies
- [ ] In-app email template library
- [ ] Multi-language support

<br/>

<div align="center">

Licensed under **MIT** — see <a href="LICENSE">LICENSE</a>.

<sub>Built with a lot of coffee by <a href="https://github.com/Tanvir0072309">Tanvir</a></sub>

</div>

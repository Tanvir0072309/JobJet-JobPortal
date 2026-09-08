<div align="center">

  <img src="https://res.cloudinary.com/dat8orrws/image/upload/v1788690254/Gemini_Generated_Image_mc57kzmc57kzmc57.png" alt="JobJet Logo" width="140" style="border-radius: 24px; margin-bottom: 10px;" />

  # JobJet

  ### AI-Powered Job Application Automation, Right From Your Phone

  Find companies near any location, discover a real contact email, let AI draft your application, and send it — all in one flow.

  <br />

  [![Download APK](https://img.shields.io/badge/⚡_Download_Android_APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)]([https://github.com/Tanvir0072309/JobJet-JobPortal/](https://expo.dev/artifacts/eas/fYyjX9xytTncIm2QJ5q6dijUpML-lQ1qXgO3zXN3vaY.apk))
  [![Backend Status](https://img.shields.io/badge/API-Live_on_Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://jobjet-jobportal.onrender.com)

  <br />

  [![PostgreSQL](https://img.shields.io/badge/Database-Neon.tech-00E599?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
  [![Expo](https://img.shields.io/badge/Mobile-Expo_React_Native-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
  [![NodeJS](https://img.shields.io/badge/Server-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
  [![Groq](https://img.shields.io/badge/AI-Groq-F55036?style=flat-square)](https://groq.com)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

</div>

<br />

<details>
<summary><b>📖 Table of Contents</b></summary>

- [About The Project](#-about-the-project)
- [How It Works](#-how-it-works)
- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Quick Download & Install](#-quick-download--install)
- [Project Structure](#-project-structure)
- [Getting Started (Local Development)](#-getting-started-local-development)
- [Environment Variables](#-environment-variables)
- [Building the Android APK](#-building-the-android-apk)
- [Roadmap](#-roadmap)
- [License](#-license)

</details>

<br />

## 🎯 About The Project

**JobJet** takes the repetitive, tedious part of job hunting — finding companies, digging up a real contact, writing a personalized email, sending it, then checking your inbox for replies — and automates the whole chain.

Built as a full-stack mobile app: an **Expo React Native** client talking to a **Node.js / Express** API, backed by **Neon Postgres**, with pluggable third-party integrations for company discovery, contact lookup, AI writing, and email delivery.

---

## ⚙️ How It Works

```
📍 Location  →  🏢 Discover Companies  →  📧 Find Contact Email  →  ✍️ AI Drafts Email  →  📤 Send  →  📥 Track Replies
```

1. **Discover** — Enter a city/area; JobJet geocodes it and pulls nearby companies with a public website (via OpenStreetMap).
2. **Find a contact** — For each company, JobJet looks up a real contact email using the [Tomba.io](https://tomba.io) API.
3. **Draft** — Groq-powered AI writes a personalized application email using your profile, resume, and the company's details.
4. **Send** — The email goes out from your own SMTP account (Gmail, Outlook, etc.), with your resume/cover letter attached.
5. **Track** — JobJet checks your inbox (via IMAP) for replies and keeps your application pipeline up to date.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🔐 **Secure Authentication** | JWT-based sessions, bcrypt-hashed passwords, persisted securely on-device. |
| 📍 **Location-Based Discovery** | Find real, nearby companies by city/area using free OpenStreetMap data. |
| 📇 **Contact Finder** | Automatically resolves a company's best contact email via Tomba.io. |
| 🤖 **AI Application Writer** | Groq-powered LLM drafts a tailored application email per company. |
| 📎 **Document Manager** | Upload and manage resumes, cover letters, and portfolios (PDF/DOC/DOCX/PNG/JPG). |
| ✉️ **Bring-Your-Own SMTP** | Send from your own Gmail/Outlook/etc. account — no shared sending infrastructure. |
| 📊 **Application Tracking** | Dashboard view of sent, replied, interviewing, and rejected applications. |
| 🔑 **Your Own API Keys** | Every integration (Groq, Tomba, SMTP) is configured with your own free-tier keys, encrypted at rest. |

---

## 🛠️ Tech Stack

**Frontend (Mobile App)**
- React Native + Expo SDK 57, Expo Router (file-based navigation)
- TypeScript
- EAS Build for `.apk` / `.aab` production builds
- `expo-secure-store` for on-device session persistence

**Backend (REST API)**
- Node.js + Express 5
- PostgreSQL (hosted on [Neon](https://neon.tech))
- JWT auth, AES-256-GCM encrypted credential storage
- Multer (file uploads), Nodemailer (SMTP), ImapFlow (reply tracking)
- Hosted on [Render](https://render.com)

**Third-Party Integrations (each configured with your own free-tier key)**
- [Groq](https://groq.com) — AI email generation
- [Tomba.io](https://tomba.io) — company contact email lookup
- OpenStreetMap (Nominatim + Overpass) — location-based company discovery, no key required

---

## 📲 Quick Download & Install

1. Tap **Download Android APK** above, or grab the [latest build directly](https://expo.dev/artifacts/eas/iAtk2TKyDVXBbfdbYKtjdpFRFnGfTcYQ7c0e16s5cSk.apk).
2. Open the downloaded `.apk` on your phone.
3. If prompted, enable **"Install from Unknown Sources"** for your browser/file manager.
4. Launch **JobJet**, create an account, and add your API keys under **Settings**.

---

## 📁 Project Structure

```
jobjet/
├── backend/                 # Node.js + Express REST API
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Groq, Tomba, mailer, IMAP, OSM integrations
│   │   ├── middleware/       # Auth guard, error handling
│   │   ├── db/               # Schema + migration script
│   │   └── utils/            # Crypto, JWT, credential helpers
│   ├── .env.example
│   └── server.js
│
└── frontend/                 # Expo React Native app
    ├── src/
    │   ├── app/               # Expo Router screens
    │   ├── components/        # Shared UI components
    │   ├── services/          # API client per feature
    │   └── context/           # Auth context
    ├── app.json
    └── eas.json
```

---

## 💻 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) (or any) PostgreSQL database
- Expo Go app (for quick testing) or Android Studio emulator

### 1. Clone the repository
```bash
git clone https://github.com/Tanvir0072309/JobJet-JobPortal.git
cd JobJet-JobPortal
```

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env   # then fill in the values — see table below
npm run migrate         # creates/updates all tables
npm run dev              # starts the API on http://localhost:5000
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
npx expo install expo-secure-store
npx expo start
```
Scan the QR code with **Expo Go**, or press `a` to launch on an Android emulator.

---

## 🔑 Environment Variables

Set these in `backend/.env` for local development, and in your host's dashboard (e.g. Render → Environment) for production. **These are app-level secrets only** — end users configure their own Groq/Tomba/SMTP keys from inside the app's Settings screen, not here.

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Postgres connection string (Neon or any Postgres) |
| `JWT_SECRET` | Long random string used to sign login sessions |
| `JWT_EXPIRES_IN` | Session lifetime, e.g. `7d` |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) — encrypts saved API keys/SMTP passwords at rest. Generate with:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `JOBJET_CONTACT_EMAIL` | Your own contact email, sent as part of the User-Agent when calling OpenStreetMap's free geocoder (required by their usage policy) |
| `PORT` | Port the API listens on (Render sets this automatically) |

---

## 📦 Building the Android APK

The project is already wired for [EAS Build](https://docs.expo.dev/build/introduction/) — no local Android SDK needed.

```bash
npm install -g eas-cli
eas login
cd frontend
eas build --profile preview --platform android
```

The `preview` profile builds a installable `.apk` and points it at the production API (`EXPO_PUBLIC_API_URL` in `eas.json`). Use `--profile production` for a Play Store `.aab` bundle instead.

---

## 🗺️ Roadmap

- [ ] iOS build via EAS
- [ ] Push notifications for new replies
- [ ] In-app email templates library
- [ ] Multi-language support

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Tanvir0072309">Tanvir</a></sub>
</div>

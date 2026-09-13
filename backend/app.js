const express = require("express");
const cors = require("cors");
const path = require("path");
const env = require("./src/config/env");
const { notFoundHandler, errorHandler } = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/authRoutes");
const profileRoutes = require("./src/routes/profileRoutes");
const documentsRoutes = require("./src/routes/documentsRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const companiesRoutes = require("./src/routes/companiesRoutes");
const jobsRoutes = require("./src/routes/jobsRoutes");
const applicationsRoutes = require("./src/routes/applicationsRoutes");
const emailRoutes = require("./src/routes/emailRoutes");
const gmailRoutes = require("./src/routes/gmailRoutes");

const app = express();

// Make sure the uploads folders exist before anything tries to read/write to
// them - a fresh clone/deploy (or a redeploy on a host with a wiped disk)
// otherwise throws "ENOENT: no such file or directory" the first time a
// document is uploaded or an avatar is saved, since Node/multer don't create
// missing parent folders on their own for every code path that touches them.
const fs = require("fs");
fs.mkdirSync(path.join(__dirname, "uploads", "avatars"), { recursive: true });

// NOTE: the old background IMAP reply-poller (replyNotifier.js /
// imapService.js) has been removed along with the SMTP/App Password system
// it depended on. The Gmail OAuth connection this app now uses is scoped to
// gmail.send ONLY (by design - no inbox reading), so there is no
// credential left that could poll an inbox. See emailController.js's
// checkReplies for the user-facing explanation.

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

// Profile pictures (and nothing else - resumes/documents are intentionally
// NOT served from here, they stay behind requireAuth via their own routes)
// are static, publicly-reachable files so <Image> tags in the app can load
// them directly without an Authorization header.
app.use("/uploads/avatars", express.static(path.join(__dirname, "uploads", "avatars")));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "✈️ Welcome to JobJet API",
  });
});

app.get("/health", async (req, res) => {
  const db = require("./src/config/db");
  const dbOk = await db.checkConnection();
  res.status(dbOk ? 200 : 503).json({ success: dbOk, database: dbOk ? "connected" : "unreachable" });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/gmail", gmailRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

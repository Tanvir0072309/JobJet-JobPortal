const express = require("express");
const cors = require("cors");
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

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

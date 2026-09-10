const express = require("express");
const { startOAuth, oauthCallback, getStatus, disconnect } = require("../controllers/gmailController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Public: Google redirects here directly with no Authorization header.
// Security comes from the signed `state` param (see gmailService.js), not
// from requireAuth - this route intentionally sits before router.use(requireAuth).
router.get("/oauth/callback", oauthCallback);

router.use(requireAuth);
router.post("/oauth/start", startOAuth);
router.get("/status", getStatus);
router.post("/disconnect", disconnect);

module.exports = router;

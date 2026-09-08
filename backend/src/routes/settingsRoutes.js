const express = require("express");
const {
  listApiCredentials,
  saveApiCredential,
  deleteApiCredential,
  savePushToken,
  getApplicationSettings,
  updateApplicationSettings,
} = require("../controllers/settingsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/api-credentials", listApiCredentials);
router.put("/api-credentials", saveApiCredential);
router.delete("/api-credentials/:provider", deleteApiCredential);

router.get("/application", getApplicationSettings);
router.put("/application", updateApplicationSettings);

router.put("/push-token", savePushToken);

module.exports = router;

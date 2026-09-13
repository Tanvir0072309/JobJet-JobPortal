const express = require("express");
const {
  listApiCredentials,
  saveApiCredential,
  deleteApiCredential,
  savePushToken,
  getApplicationSettings,
  updateApplicationSettings,
  eraseEmails,
  eraseAllData,
  deleteAccount,
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

router.delete("/erase-emails", eraseEmails);
router.delete("/erase-all-data", eraseAllData);
router.delete("/delete-account", deleteAccount);

module.exports = router;

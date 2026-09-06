const express = require("express");
const { getProfile, updateProfile } = require("../controllers/profileController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getProfile);
router.put("/", updateProfile);

module.exports = router;

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { getProfile, updateProfile, uploadAvatar } = require("../controllers/profileController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);

const AVATAR_ROOT = path.join(__dirname, "..", "..", "uploads", "avatars");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(AVATAR_ROOT, { recursive: true });
    cb(null, AVATAR_ROOT);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED.has(ext)) return cb(null, true);
    const err = new Error("Please upload a PNG, JPG, or WEBP image.");
    err.status = 400;
    cb(err);
  },
});

router.get("/", getProfile);
router.put("/", updateProfile);
router.post("/avatar", upload.single("avatar"), uploadAvatar);

module.exports = router;

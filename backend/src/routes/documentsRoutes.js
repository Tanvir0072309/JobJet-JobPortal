const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  listDocuments,
  uploadDocument,
  deleteDocument,
  setDefaultDocument,
  UPLOAD_ROOT,
} = require("../controllers/documentsController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_ROOT, req.user.id);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    const err = new Error("Please upload a PDF, Word document (.doc/.docx), PNG, or JPG file.");
    err.status = 400;
    cb(err);
  },
});

router.get("/", listDocuments);
router.post("/", upload.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);
router.patch("/:id/default", setDefaultDocument);

module.exports = router;

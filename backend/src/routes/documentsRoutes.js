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

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);

// Mobile file pickers (especially Android content:// URIs) frequently hand
// back an empty mimetype or a generic "application/octet-stream" one, even
// for a perfectly valid PDF/DOCX - the OS just didn't bother resolving it.
// Relying on mimetype alone rejected those real files with a false
// "unsupported file format" error, so we also accept based on the file
// extension and normalize the mimetype we store from that.
const GENERIC_MIME_TYPES = new Set(["application/octet-stream", "", undefined, null]);

const EXTENSION_TO_MIME = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }

    // Mimetype was missing/generic - fall back to trusting the extension.
    if (GENERIC_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      file.mimetype = EXTENSION_TO_MIME[ext];
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

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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get("/", listDocuments);
router.post("/", upload.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);
router.patch("/:id/default", setDefaultDocument);

module.exports = router;

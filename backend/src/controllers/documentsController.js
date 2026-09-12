const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

const listDocuments = asyncHandler(async (req, res) => {
  const result = await db.query(
    "SELECT id, name, document_type, file_type, file_size_bytes, is_default, post_tag, created_at, updated_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ success: true, documents: result.rows });
});

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  const documentType = req.body.document_type || "other";
  const displayName = req.body.name || req.file.originalname;
  // Optional: which interested post (job title) this resume/project_list is
  // written for, e.g. "Backend Developer" - null means the general/default
  // one for its document_type. See applicationsController.pickAttachmentsForPost.
  const postTag = typeof req.body.post_tag === "string" && req.body.post_tag.trim() ? req.body.post_tag.trim() : null;

  const result = await db.query(
    `INSERT INTO documents (user_id, name, document_type, file_type, file_path, file_size_bytes, post_tag)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, document_type, file_type, file_size_bytes, is_default, post_tag, created_at`,
    [
      req.user.id,
      displayName,
      documentType,
      req.file.mimetype,
      req.file.path,
      req.file.size,
      postTag,
    ]
  );

  res.status(201).json({ success: true, document: result.rows[0] });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    "SELECT file_path FROM documents WHERE id = $1 AND user_id = $2",
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  await db.query("DELETE FROM documents WHERE id = $1 AND user_id = $2", [id, req.user.id]);

  const filePath = result.rows[0].file_path;
  fs.promises.unlink(filePath).catch(() => {
    // File may already be gone; deletion of the DB row is what matters most.
  });

  res.json({ success: true, message: "Document deleted." });
});

const setDefaultDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await db.query(
    "SELECT id, document_type FROM documents WHERE id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  const { document_type: documentType } = existing.rows[0];

  // Only one default per document type per user.
  await db.query(
    "UPDATE documents SET is_default = false WHERE user_id = $1 AND document_type = $2",
    [req.user.id, documentType]
  );
  await db.query("UPDATE documents SET is_default = true, updated_at = now() WHERE id = $1", [id]);

  res.json({ success: true, message: "Default document updated." });
});

module.exports = { listDocuments, uploadDocument, deleteDocument, setDefaultDocument, UPLOAD_ROOT };

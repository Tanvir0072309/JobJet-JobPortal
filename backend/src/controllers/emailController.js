const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

// Unread replies, surfaced at the top of the Applications page.
const listUnreadReplies = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT em.*, a.id AS application_id, c.name AS company_name, j.title AS job_title
     FROM email_messages em
     JOIN applications a ON a.id = em.application_id
     LEFT JOIN companies c ON c.id = a.company_id
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE em.user_id = $1 AND em.direction = 'inbound' AND em.is_read = false
     ORDER BY em.received_at DESC NULLS LAST, em.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, replies: result.rows });
});

const markThreadRead = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;

  const owns = await db.query("SELECT id FROM applications WHERE id = $1 AND user_id = $2", [
    applicationId,
    req.user.id,
  ]);
  if (owns.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Application not found." });
  }

  await db.query(
    "UPDATE email_messages SET is_read = true WHERE application_id = $1 AND user_id = $2",
    [applicationId, req.user.id]
  );
  await db.query(
    "UPDATE applications SET has_unread_reply = false WHERE id = $1 AND user_id = $2",
    [applicationId, req.user.id]
  );

  res.json({ success: true, message: "Thread marked as read." });
});

// Reply-checking used to read the user's inbox via IMAP using the same
// App Password credential as SMTP sending. That system has been removed:
// Gmail sending is now done via OAuth scoped to gmail.send ONLY, which
// deliberately does not include any inbox-reading permission
// (gmail.readonly/modify/mail.google.com), so there is no credential left
// that could check for replies. Kept as a 200 (not an error) with
// newReplies: 0 so the frontend's existing "Check for replies" flow (which
// expects { success, newReplies }) keeps working without a crash - it just
// always reports nothing new for now.
const checkReplies = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    newReplies: 0,
    replies: [],
    message: "Reply checking isn't available - JobJet's Gmail connection is send-only and doesn't read your inbox.",
  });
});

module.exports = { listUnreadReplies, markThreadRead, checkReplies };

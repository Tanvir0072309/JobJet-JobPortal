const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { getCredential } = require("../utils/credentials");
const replyNotifier = require("../services/replyNotifier");

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

// Pulls new replies from the user's actual inbox via IMAP, stores them, and
// pushes a notification to the user's device for each new one. Triggered
// on-demand from the app (pull-to-refresh / a "Check replies" button); the
// same logic also runs periodically in the background (see
// replyNotifier.startReplyPolling, started from app.js) so a notification
// can arrive even without the app being open.
const checkReplies = asyncHandler(async (req, res) => {
  const smtpRaw = await getCredential(req.user.id, "smtp");
  if (!smtpRaw) {
    return res.status(400).json({
      success: false,
      code: "SMTP_NOT_CONFIGURED",
      message: "Add your sending email account in Settings first - replies are checked from that same inbox.",
    });
  }

  try {
    const result = await replyNotifier.checkRepliesAndNotify(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({ success: false, code: "IMAP_CHECK_FAILED", message: err.message });
  }
});

module.exports = { listUnreadReplies, markThreadRead, checkReplies };

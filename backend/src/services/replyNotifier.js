// Shared by the on-demand "Check replies" button (emailController) and the
// background poller (started from app.js) so both send notifications the
// same way and never drift apart.
const db = require("../config/db");
const { getCredential } = require("../utils/credentials");
const imapService = require("./imapService");
const { sendPushNotification } = require("./pushService");

// Runs an IMAP reply check for one user and, for every newly-found reply,
// pushes a "X replied" notification to their device (if they've registered
// one). Returns whatever imapService.checkReplies returned.
async function checkRepliesAndNotify(userId) {
  const smtpRaw = await getCredential(userId, "smtp");
  if (!smtpRaw) return { newReplies: 0, replies: [] };

  const smtpConfig = JSON.parse(smtpRaw);
  const result = await imapService.checkReplies(userId, smtpConfig);

  if (result.newReplies > 0 && result.replies?.length) {
    await notifyUserOfReplies(userId, result.replies);
  }

  return result;
}

async function notifyUserOfReplies(userId, replies) {
  const userRow = await db.query(
    `SELECT u.push_token, p.full_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const pushToken = userRow.rows[0]?.push_token;
  if (!pushToken) return;

  const firstName = userRow.rows[0]?.full_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName}, ` : "";

  for (const reply of replies) {
    const companyLabel = reply.companyName || "A company";
    const roleSuffix = reply.jobTitle ? ` for ${reply.jobTitle}` : "";
    await sendPushNotification(pushToken, {
      title: `📬 Reply from ${companyLabel}`,
      body: `${greeting}${companyLabel} replied to your application${roleSuffix}.`,
      data: { type: "email_reply", applicationId: reply.applicationId },
    });
  }
}

// Background poller: this backend deliberately has no separate worker
// process (see imapService.js), so replies are also checked periodically
// in-process - that way a notification can still arrive if the user hasn't
// opened the app. Best-effort only: if the host (e.g. Render's free tier)
// spins the instance down when idle, this simply won't run until the next
// request wakes it back up.
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let pollInProgress = false;

async function pollAllUsers() {
  if (pollInProgress) return; // never run two sweeps at once
  pollInProgress = true;
  try {
    const users = await db.query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN api_credentials ac ON ac.user_id = u.id AND ac.provider = 'smtp'
       WHERE u.push_token IS NOT NULL`
    );

    for (const { id } of users.rows) {
      try {
        await checkRepliesAndNotify(id);
      } catch (err) {
        // One user's IMAP being down/misconfigured shouldn't stop the sweep.
        console.error(`Background reply check failed for user ${id}:`, err.message);
      }
    }
  } finally {
    pollInProgress = false;
  }
}

function startReplyPolling() {
  setInterval(() => {
    pollAllUsers().catch((err) => console.error("Reply polling run failed:", err.message));
  }, POLL_INTERVAL_MS);
}

module.exports = { checkRepliesAndNotify, startReplyPolling };

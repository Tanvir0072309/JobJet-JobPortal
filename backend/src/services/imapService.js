// Reads replies to sent applications back from the user's own inbox via
// IMAP, and stores them as inbound email_messages. Called both on-demand
// (pull-to-refresh / "Check for replies" button, via emailController.js)
// and from a periodic background sweep (see services/replyNotifier.js),
// since this backend has no separate persistent worker process of its own.
const { ImapFlow } = require("imapflow");
const db = require("../config/db");

// Auto-detected IMAP settings for common providers, keyed by email domain.
// Used when the user hasn't entered an explicit imapHost in Settings.
const WELL_KNOWN_IMAP = {
  "gmail.com": { host: "imap.gmail.com", port: 993 },
  "googlemail.com": { host: "imap.gmail.com", port: 993 },
  "outlook.com": { host: "outlook.office365.com", port: 993 },
  "hotmail.com": { host: "outlook.office365.com", port: 993 },
  "live.com": { host: "outlook.office365.com", port: 993 },
  "office365.com": { host: "outlook.office365.com", port: 993 },
  "yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
  "icloud.com": { host: "imap.mail.me.com", port: 993 },
  "zoho.com": { host: "imap.zoho.com", port: 993 },
};

function resolveImapConfig(smtpConfig) {
  if (smtpConfig.imapHost) {
    return { host: smtpConfig.imapHost, port: Number(smtpConfig.imapPort) || 993 };
  }
  const domain = String(smtpConfig.user).split("@")[1]?.toLowerCase();
  const known = domain && WELL_KNOWN_IMAP[domain];
  if (known) return known;
  return null;
}

// Pulls plain text out of a fetched message's bodyParts, preferring text/plain.
function extractText(message) {
  if (message.text) return message.text;
  if (message.html) return message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

// Checks the mailbox for replies from anyone we've previously sent an
// application to, and records new ones. Safe to call repeatedly - already
// seen messages are skipped via the unique index on provider_message_id.
async function checkReplies(userId, smtpConfig) {
  const imapConfig = resolveImapConfig(smtpConfig);
  if (!imapConfig) {
    throw new Error(
      "Couldn't auto-detect IMAP settings for this email provider. Add \"IMAP host\" (and port, default 993) in Settings."
    );
  }

  // Only addresses we've actually mailed - nothing else in the inbox is
  // relevant. Company/job name are pulled in here too (rather than looked
  // up later) so callers can build a "X replied" notification without a
  // second round trip.
  const sentTo = await db.query(
    `SELECT DISTINCT a.recipient_email, a.id AS application_id, c.name AS company_name, j.title AS job_title
     FROM applications a
     LEFT JOIN companies c ON c.id = a.company_id
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1 AND a.recipient_email IS NOT NULL
       AND a.status IN ('sent', 'replied', 'interview', 'rejected')`,
    [userId]
  );
  if (sentTo.rows.length === 0) {
    return { newReplies: 0, replies: [] };
  }
  const addressToApp = new Map(
    sentTo.rows.map((r) => [
      r.recipient_email.toLowerCase(),
      { applicationId: r.application_id, companyName: r.company_name, jobTitle: r.job_title },
    ])
  );

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: true,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    logger: false,
  });

  let newReplies = 0;
  const replies = []; // { applicationId, companyName, jobTitle, subject } - for push notifications

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Look back 30 days - plenty for a job-application reply window, and
      // keeps each check fast instead of scanning the whole mailbox.
      const since = new Date();
      since.setDate(since.getDate() - 30);

      for (const [fromAddress, appInfo] of addressToApp) {
        const { applicationId, companyName, jobTitle } = appInfo;
        const uids = await client.search({ from: fromAddress, since }, { uid: true });
        if (!uids || uids.length === 0) continue;

        for await (const message of client.fetch(uids, { envelope: true, source: false, bodyParts: ["text", "html"] }, { uid: true })) {
          const providerMessageId = message.envelope?.messageId || `${message.uid}@${imapConfig.host}`;
          const subject = message.envelope?.subject || "(no subject)";
          const receivedAt = message.envelope?.date || new Date();
          const plainText = message.bodyParts?.get("text")?.toString("utf8");
          const htmlText = message.bodyParts?.get("html")?.toString("utf8");
          const bodyText = extractText({ text: plainText, html: htmlText });

          const inserted = await db.query(
            `INSERT INTO email_messages
               (application_id, user_id, direction, from_address, to_address, subject, body, provider_message_id, received_at)
             VALUES ($1, $2, 'inbound', $3, $4, $5, $6, $7, $8)
             ON CONFLICT (provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING
             RETURNING id`,
            [applicationId, userId, fromAddress, smtpConfig.user, subject, bodyText, providerMessageId, receivedAt]
          );

          if (inserted.rows.length > 0) {
            newReplies += 1;
            replies.push({ applicationId, companyName, jobTitle, subject });
            // Don't downgrade a status the user has already moved forward
            // manually (e.g. they marked it "interview") back to "replied".
            await db.query(
              `UPDATE applications
               SET has_unread_reply = true,
                   status = CASE WHEN status IN ('sent') THEN 'replied' ELSE status END,
                   updated_at = now()
               WHERE id = $1`,
              [applicationId]
            );
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  return { newReplies, replies };
}

module.exports = { checkReplies, resolveImapConfig };

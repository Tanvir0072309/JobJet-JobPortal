const db = require("../config/db");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { getCredential } = require("../utils/credentials");
const emailFinderService = require("../services/emailFinderService");
const groqService = require("../services/groqService");
const gmailService = require("../services/gmailService");

// Only resume + project_list are ever attached to an application email.
// A candidate can keep a different resume/project-list per post (tagged via
// documents.post_tag, e.g. "Backend Developer") - when applying for a job
// whose title matches a tag, that pair is used; otherwise we fall back to
// whichever resume/project_list is marked as the default for its type.
const ATTACHMENT_TYPES = ["resume", "project_list"];

async function pickAttachmentsForPost(userId, postTitle) {
  const matched = [];
  const matchedTypes = new Set();

  if (postTitle) {
    const tagged = await db.query(
      `SELECT DISTINCT ON (document_type) *
       FROM documents
       WHERE user_id = $1 AND document_type = ANY($2::text[]) AND post_tag IS NOT NULL AND lower(post_tag) = lower($3)
       ORDER BY document_type, updated_at DESC`,
      [userId, ATTACHMENT_TYPES, postTitle]
    );
    for (const row of tagged.rows) {
      matched.push(row);
      matchedTypes.add(row.document_type);
    }
  }

  const missingTypes = ATTACHMENT_TYPES.filter((t) => !matchedTypes.has(t));
  if (missingTypes.length) {
    const fallback = await db.query(
      `SELECT * FROM documents WHERE user_id = $1 AND document_type = ANY($2::text[]) AND is_default = true`,
      [userId, missingTypes]
    );
    for (const row of fallback.rows) {
      matched.push(row);
      matchedTypes.add(row.document_type);
    }
  }

  // Every application email should have a resume attached if the candidate
  // has uploaded one at all - if there's still no resume after the tag and
  // default lookups above (e.g. nothing was ever marked as default), fall
  // back to whichever resume was uploaded most recently rather than sending
  // with no resume attached at all.
  if (!matchedTypes.has("resume")) {
    const anyResume = await db.query(
      `SELECT * FROM documents WHERE user_id = $1 AND document_type = 'resume' ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (anyResume.rows[0]) matched.push(anyResume.rows[0]);
  }

  return matched;
}

// Server-side, per-user daily send count - computed from applications.sent_at
// rather than a separate counter table, so it can't drift and needs no
// extra schema. Not something the client can influence at all, so it's not
// bypassable by a client-side change.
async function getSentTodayCount(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM applications
     WHERE user_id = $1 AND status = 'sent' AND sent_at >= date_trunc('day', now())`,
    [userId]
  );
  return result.rows[0].count;
}

const VALID_STATUSES = [
  "draft",
  "generated",
  "ready_to_send",
  "sent",
  "replied",
  "interview",
  "rejected",
  "archived",
];

// Applications page header stats.
const getSummary = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM applications WHERE user_id = $1 GROUP BY status`,
    [req.user.id]
  );

  const summary = {
    total: 0,
    sent: 0,
    replied: 0,
    interview: 0,
    rejected: 0,
  };

  for (const row of result.rows) {
    summary.total += row.count;
    if (row.status in summary) summary[row.status] = row.count;
  }

  res.json({ success: true, summary });
});

// List applications for the Applications page, newest / unread-reply first.
const listApplications = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT a.*, c.name AS company_name, j.title AS job_title
     FROM applications a
     LEFT JOIN companies c ON c.id = a.company_id
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1
     ORDER BY a.has_unread_reply DESC, a.updated_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, applications: result.rows });
});

const getApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appResult = await db.query(
    `SELECT a.*, c.name AS company_name, j.title AS job_title
     FROM applications a
     LEFT JOIN companies c ON c.id = a.company_id
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [id, req.user.id]
  );

  if (appResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Application not found." });
  }

  const messages = await db.query(
    "SELECT * FROM email_messages WHERE application_id = $1 AND user_id = $2 ORDER BY created_at ASC",
    [id, req.user.id]
  );

  res.json({ success: true, application: appResult.rows[0], thread: messages.rows });
});

// Creates a draft application row (before AI generation exists). Prevents
// duplicate drafts to the same company/job/recipient per the schema's
// unique constraint.
const createApplication = asyncHandler(async (req, res) => {
  const { companyId, jobId, recipientEmail } = req.body;

  if (!companyId) {
    return res.status(400).json({ success: false, message: "companyId is required." });
  }

  const company = await db.query("SELECT id FROM companies WHERE id = $1 AND user_id = $2", [
    companyId,
    req.user.id,
  ]);
  if (company.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Company not found." });
  }

  const result = await db.query(
    `INSERT INTO applications (user_id, company_id, job_id, recipient_email, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING *`,
    [req.user.id, companyId, jobId || null, recipientEmail || null]
  );

  res.status(201).json({ success: true, application: result.rows[0] });
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
  }

  const result = await db.query(
    `UPDATE applications SET status = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [status, id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Application not found." });
  }

  res.json({ success: true, application: result.rows[0] });
});

// Generates personalized email drafts (Groq) for the given companies without
// sending anything - lets the user review before applyToCompanies sends.
const generateWithAI = asyncHandler(async (req, res) => {
  const { companyIds } = req.body;
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({ success: false, message: "Select at least one company." });
  }

  const groqKey = await getCredential(req.user.id, "groq");
  if (!groqKey) {
    return res.status(400).json({
      success: false,
      code: "GROQ_NOT_CONFIGURED",
      message: "Add your Groq API key in Settings first.",
    });
  }

  const profileRes = await db.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);
  const profile = profileRes.rows[0] || {};
  const settingsRes = await db.query("SELECT * FROM application_settings WHERE user_id = $1", [req.user.id]);
  const settings = settingsRes.rows[0] || {};

  const results = [];
  for (const companyId of companyIds) {
    try {
      const companyRes = await db.query(
        `SELECT c.*, (SELECT json_agg(j) FROM jobs j WHERE j.company_id = c.id) AS jobs
         FROM companies c WHERE c.id = $1 AND c.user_id = $2`,
        [companyId, req.user.id]
      );
      const company = companyRes.rows[0];
      if (!company) {
        results.push({ companyId, status: "error", message: "Company not found." });
        continue;
      }
      const job = company.jobs?.[0] || null;

      // One Groq call per company - never repeated within this loop.
      const generated = await groqService.generateApplicationEmail(
        { profile, company, job, tone: settings.application_tone || "professional" },
        groqKey
      );

      const appResult = await db.query(
        `INSERT INTO applications (user_id, company_id, job_id, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, 'generated')
         ON CONFLICT (user_id, company_id, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(recipient_email, ''))
         DO UPDATE SET subject = $4, body = $5, status = 'generated', updated_at = now()
         RETURNING *`,
        [req.user.id, company.id, job?.id || null, generated.subject, generated.body]
      );

      results.push({ companyId, company: company.name, status: "generated", application: appResult.rows[0] });
    } catch (err) {
      results.push({ companyId, status: "error", message: err.message });
    }
  }

  res.json({ success: true, results });
});

// The full "one-click apply" pipeline for N selected companies, triggered by
// a single request from the frontend. Per company (never more than once
// each, and only when not already cached): an email-finder (Hunter if
// configured, else JobJet's own built-in website scraper - no signup, no
// key, always available) locates the contact email, Groq writes the email,
// then it's sent via the user's connected Gmail account (Gmail API, OAuth)
// with their default documents attached.
const applyToCompanies = asyncHandler(async (req, res) => {
  const { companyIds } = req.body;
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({ success: false, message: "Select at least one company." });
  }

  const [groqKey, userRow] = await Promise.all([
    getCredential(req.user.id, "groq"),
    db.query("SELECT gmail_connected FROM users WHERE id = $1", [req.user.id]),
  ]);

  if (!groqKey) {
    return res
      .status(400)
      .json({ success: false, code: "GROQ_NOT_CONFIGURED", message: "Add your Groq API key in Settings first." });
  }

  if (!userRow.rows[0]?.gmail_connected) {
    return res.status(400).json({
      success: false,
      code: "GMAIL_NOT_CONNECTED",
      message: "Connect your Gmail account first - go to Settings to connect it.",
    });
  }

  const profileRes = await db.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);
  const profile = profileRes.rows[0] || {};
  const settingsRes = await db.query("SELECT * FROM application_settings WHERE user_id = $1", [req.user.id]);
  const settings = settingsRes.rows[0] || {};

  const results = [];
  let sentSoFarToday = await getSentTodayCount(req.user.id);

  for (const companyId of companyIds) {
    if (sentSoFarToday >= env.dailyEmailLimitPerUser) {
      results.push({
        companyId,
        status: "skipped",
        message: `Daily sending limit reached (${env.dailyEmailLimitPerUser}/day). Try again tomorrow.`,
      });
      continue;
    }
    try {
      const companyRes = await db.query(
        `SELECT c.*,
           (SELECT json_agg(j) FROM jobs j WHERE j.company_id = c.id) AS jobs,
           (SELECT json_agg(cc) FROM company_contacts cc WHERE cc.company_id = c.id) AS contacts
         FROM companies c WHERE c.id = $1 AND c.user_id = $2`,
        [companyId, req.user.id]
      );
      const company = companyRes.rows[0];
      if (!company) {
        results.push({ companyId, status: "error", message: "Company not found." });
        continue;
      }

      // The hiring-email finder is only called when we don't already have a
      // saved contact (normally there already is one - discoverCompanies
      // looks this up at search time now). Only ever a confirmed hiring
      // contact, never a generic info@/contact@ guess - see
      // emailFinderService for the accuracy-first fallback chain.
      let contactEmail = company.contacts?.[0]?.email || null;
      if (!contactEmail) {
        const hiring = await emailFinderService.findHiringEmail({ userId: req.user.id, company, groqKey });
        if (hiring?.email) {
          contactEmail = hiring.email;
          await db.query(
            `INSERT INTO company_contacts (company_id, user_id, email, contact_type, confidence, source)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [company.id, req.user.id, hiring.email, hiring.type, hiring.confidence, hiring.source]
          );
        }
      }

      if (!contactEmail) {
        results.push({
          companyId,
          company: company.name,
          status: "skipped",
          message: "No confirmed hiring email found for this company.",
        });
        continue;
      }

      const job = company.jobs?.[0] || null;

      // One Groq call per company.
      const generated = await groqService.generateApplicationEmail(
        { profile, company, job, tone: settings.application_tone || "professional" },
        groqKey
      );

      const finalBody = settings.email_signature ? `${generated.body}\n\n${settings.email_signature}` : generated.body;

      // Resume + project list only, matched to this specific job's title
      // when the candidate has tagged a pair for that post - otherwise the
      // default resume/project list is used.
      const attachments = await pickAttachmentsForPost(req.user.id, job?.title);

      const appResult = await db.query(
        `INSERT INTO applications (user_id, company_id, job_id, recipient_email, subject, body, status, selected_document_ids)
         VALUES ($1, $2, $3, $4, $5, $6, 'ready_to_send', $7)
         ON CONFLICT (user_id, company_id, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(recipient_email, ''))
         DO UPDATE SET subject = $5, body = $6, status = 'ready_to_send', updated_at = now()
         RETURNING *`,
        [
          req.user.id,
          company.id,
          job?.id || null,
          contactEmail,
          generated.subject,
          finalBody,
          JSON.stringify(attachments.map((d) => d.id)),
        ]
      );
      const application = appResult.rows[0];

      // Send it, with the user's default documents (e.g. resume) attached.
      await gmailService.sendApplicationEmail({
        userId: req.user.id,
        to: contactEmail,
        subject: generated.subject,
        body: finalBody,
        documents: attachments,
      });
      sentSoFarToday += 1;

      await db.query(`UPDATE applications SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`, [
        application.id,
      ]);
      await db.query(
        `INSERT INTO email_messages (application_id, user_id, direction, from_address, to_address, subject, body)
         VALUES ($1, $2, 'outbound', (SELECT gmail_email FROM users WHERE id = $2), $3, $4, $5)`,
        [application.id, req.user.id, contactEmail, generated.subject, finalBody]
      );

      results.push({ companyId, company: company.name, status: "sent", to: contactEmail });
    } catch (err) {
      results.push({ companyId, status: "error", message: err.message });
    }
  }

  res.json({ success: true, results });
});

// Manual resend/retry of a single already-generated application.
const sendApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appRes = await db.query(
    `SELECT a.*, c.name AS company_name FROM applications a
     LEFT JOIN companies c ON c.id = a.company_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [id, req.user.id]
  );
  const application = appRes.rows[0];
  if (!application) {
    return res.status(404).json({ success: false, message: "Application not found." });
  }
  if (!application.recipient_email) {
    return res.status(400).json({ success: false, message: "This application has no recipient email yet." });
  }
  // Guards against duplicate sends on request retries (e.g. a flaky
  // connection causing the client to resend the same tap) - an application
  // that's already 'sent' won't be sent again from this endpoint.
  if (application.status === "sent") {
    return res.status(409).json({ success: false, code: "ALREADY_SENT", message: "This application was already sent." });
  }

  const userRow = await db.query("SELECT gmail_connected FROM users WHERE id = $1", [req.user.id]);
  if (!userRow.rows[0]?.gmail_connected) {
    return res
      .status(400)
      .json({ success: false, code: "GMAIL_NOT_CONNECTED", message: "Connect your Gmail account first - go to Settings to connect it." });
  }

  const sentToday = await getSentTodayCount(req.user.id);
  if (sentToday >= env.dailyEmailLimitPerUser) {
    return res.status(429).json({
      success: false,
      code: "DAILY_LIMIT_REACHED",
      message: `Daily sending limit reached (${env.dailyEmailLimitPerUser}/day). Try again tomorrow.`,
    });
  }

  const documentIds = application.selected_document_ids || [];
  const docsRes = documentIds.length
    ? await db.query("SELECT * FROM documents WHERE id = ANY($1::uuid[]) AND user_id = $2", [
        documentIds,
        req.user.id,
      ])
    : { rows: [] };

  await gmailService.sendApplicationEmail({
    userId: req.user.id,
    to: application.recipient_email,
    subject: application.subject,
    body: application.body,
    documents: docsRes.rows,
  });

  const updated = await db.query(
    `UPDATE applications SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );

  await db.query(
    `INSERT INTO email_messages (application_id, user_id, direction, from_address, to_address, subject, body)
     VALUES ($1, $2, 'outbound', (SELECT gmail_email FROM users WHERE id = $2), $3, $4, $5)`,
    [id, req.user.id, application.recipient_email, application.subject, application.body]
  );

  res.json({ success: true, application: updated.rows[0] });
});

module.exports = {
  getSummary,
  listApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
  generateWithAI,
  applyToCompanies,
  sendApplication,
};

const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { getCredential } = require("../utils/credentials");
const tombaService = require("../services/tombaService");
const groqService = require("../services/groqService");
const mailerService = require("../services/mailerService");

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
// each, and only when not already cached): Tomba finds the contact email,
// Groq writes the email, then it's sent via the user's configured SMTP
// account with their default documents attached.
const applyToCompanies = asyncHandler(async (req, res) => {
  const { companyIds } = req.body;
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({ success: false, message: "Select at least one company." });
  }

  const [groqKey, tombaRaw, smtpRaw] = await Promise.all([
    getCredential(req.user.id, "groq"),
    getCredential(req.user.id, "tomba"),
    getCredential(req.user.id, "smtp"),
  ]);

  if (!groqKey) {
    return res
      .status(400)
      .json({ success: false, code: "GROQ_NOT_CONFIGURED", message: "Add your Groq API key in Settings first." });
  }
  if (!tombaRaw) {
    return res
      .status(400)
      .json({ success: false, code: "TOMBA_NOT_CONFIGURED", message: "Add your Tomba API key/secret in Settings first." });
  }
  const tombaCredential = JSON.parse(tombaRaw);
  if (!smtpRaw) {
    return res.status(400).json({
      success: false,
      code: "SMTP_NOT_CONFIGURED",
      message: "Add your sending email account in Settings first.",
    });
  }
  const smtpConfig = JSON.parse(smtpRaw);

  const profileRes = await db.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);
  const profile = profileRes.rows[0] || {};
  const settingsRes = await db.query("SELECT * FROM application_settings WHERE user_id = $1", [req.user.id]);
  const settings = settingsRes.rows[0] || {};

  const docsRes = await db.query("SELECT * FROM documents WHERE user_id = $1 AND is_default = true", [
    req.user.id,
  ]);
  const attachments = docsRes.rows;

  const results = [];

  for (const companyId of companyIds) {
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

      // Tomba is only called when we don't already have a saved contact.
      let contactEmail = company.contacts?.[0]?.email || null;
      if (!contactEmail && company.website) {
        const domain = tombaService.extractDomain(company.website);
        const tombaData = await tombaService.domainSearch(domain, tombaCredential);
        const best = tombaService.pickBestContact(tombaData);
        if (best) {
          contactEmail = best.email;
          await db.query(
            `INSERT INTO company_contacts (company_id, user_id, email, contact_type, confidence, source)
             VALUES ($1, $2, $3, $4, $5, 'tomba')`,
            [company.id, req.user.id, best.email, best.type, best.confidence]
          );
        }
      }

      if (!contactEmail) {
        results.push({ companyId, company: company.name, status: "skipped", message: "No contact email found." });
        continue;
      }

      const job = company.jobs?.[0] || null;

      // One Groq call per company.
      const generated = await groqService.generateApplicationEmail(
        { profile, company, job, tone: settings.application_tone || "professional" },
        groqKey
      );

      const finalBody = settings.email_signature ? `${generated.body}\n\n${settings.email_signature}` : generated.body;

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
      await mailerService.sendApplicationEmail({
        smtpConfig,
        to: contactEmail,
        subject: generated.subject,
        body: finalBody,
        documents: attachments,
      });

      await db.query(`UPDATE applications SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`, [
        application.id,
      ]);
      await db.query(
        `INSERT INTO email_messages (application_id, user_id, direction, from_address, to_address, subject, body)
         VALUES ($1, $2, 'outbound', $3, $4, $5, $6)`,
        [application.id, req.user.id, smtpConfig.user, contactEmail, generated.subject, finalBody]
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

  const smtpRaw = await getCredential(req.user.id, "smtp");
  if (!smtpRaw) {
    return res
      .status(400)
      .json({ success: false, code: "SMTP_NOT_CONFIGURED", message: "Add your sending email account in Settings first." });
  }
  const smtpConfig = JSON.parse(smtpRaw);

  const documentIds = application.selected_document_ids || [];
  const docsRes = documentIds.length
    ? await db.query("SELECT * FROM documents WHERE id = ANY($1::uuid[]) AND user_id = $2", [
        documentIds,
        req.user.id,
      ])
    : { rows: [] };

  await mailerService.sendApplicationEmail({
    smtpConfig,
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
     VALUES ($1, $2, 'outbound', $3, $4, $5, $6)`,
    [id, req.user.id, smtpConfig.user, application.recipient_email, application.subject, application.body]
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

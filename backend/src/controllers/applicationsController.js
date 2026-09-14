const db = require("../config/db");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { getCredential } = require("../utils/credentials");
const emailFinderService = require("../services/emailFinderService");
const groqService = require("../services/groqService");
const gmailService = require("../services/gmailService");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Picks the one job (out of a company's fetched jobs) to actually apply to,
// restricted to the candidate's own "Interested Posts" (profile.interested_posts
// - the job titles they said they're targeting, set on the Profile screen).
// If the candidate has set interested posts, a company only gets applied to
// when at least one of its open roles' titles actually matches one of them
// - a job title that doesn't match is never emailed, no matter how good a
// fit the company otherwise looks. Matching is case-insensitive and allows
// either title to contain the other (e.g. "Backend Developer" matches
// "Senior Backend Developer") so small real-world title variations still
// count as a match. If the candidate hasn't set any interested posts yet,
// there's nothing to filter against, so the previous behavior (first listed
// job) is kept unchanged.
// Returns { job, matchedPost } where matchedPost is the exact string from
// the candidate's own interested_posts list that matched (or null if there
// were no interested posts to match against, or nothing matched). Callers
// MUST use matchedPost (not job.title) when looking up a per-post tagged
// resume/project-list, since job.title is the real-world job posting title
// (e.g. "Senior Backend Developer (Remote), Pune") which almost never
// equals the shorter interested-post label the candidate tagged their
// documents with (e.g. "Backend Developer") - comparing against job.title
// meant the tagged resume/project-list was never found, and the
// default/most-recent documents were silently sent for every application
// instead, no matter which post was actually tagged. See
// pickAttachmentsForPost below.
function pickMatchingJob(jobs, interestedPosts) {
  const list = Array.isArray(jobs) ? jobs : [];
  if (!list.length) return { job: null, matchedPost: null };

  const posts = Array.isArray(interestedPosts) ? interestedPosts.filter(Boolean) : [];
  if (posts.length === 0) return { job: list[0], matchedPost: null };

  const normalizedPosts = posts.map((p) => ({ raw: p, norm: p.toLowerCase().trim() }));
  for (const job of list) {
    const title = (job?.title || "").toLowerCase().trim();
    if (!title) continue;
    const hit = normalizedPosts.find(
      (post) => title === post.norm || title.includes(post.norm) || post.norm.includes(title)
    );
    if (hit) return { job, matchedPost: hit.raw };
  }

  return { job: null, matchedPost: null }; // no matching job title -> caller skips this company entirely.
}

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

  // Every application email should have a resume (and project list, if one
  // exists) attached if the candidate has uploaded one at all - if there's
  // still nothing after the tag and default lookups above (e.g. nothing was
  // ever explicitly marked as default), fall back to whichever document of
  // that type was uploaded most recently rather than silently sending with
  // it missing. Previously this fallback only ran for "resume", so a
  // project_list that was never marked Default would never get attached at
  // all - that's the bug behind documents "not going" with an application.
  for (const type of ATTACHMENT_TYPES) {
    if (matchedTypes.has(type)) continue;
    const anyDoc = await db.query(
      `SELECT * FROM documents WHERE user_id = $1 AND document_type = $2 ORDER BY updated_at DESC LIMIT 1`,
      [userId, type]
    );
    if (anyDoc.rows[0]) {
      matched.push(anyDoc.rows[0]);
      matchedTypes.add(type);
    }
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

// Small endpoint the Profile screen (and anywhere else) can poll to show
// "X/25 emails sent today" - reuses the exact same count the daily send
// limit itself is enforced against, so the two numbers can never disagree.
const getSendingLimitStatus = asyncHandler(async (req, res) => {
  const sentToday = await getSentTodayCount(req.user.id);
  res.json({
    success: true,
    sentToday,
    limit: env.dailyEmailLimitPerUser,
    remaining: Math.max(env.dailyEmailLimitPerUser - sentToday, 0),
  });
});

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
    `SELECT a.*, COALESCE(a.company_name_snapshot, c.name) AS company_name, COALESCE(a.company_website_snapshot, c.website) AS company_website, c.location AS company_location, j.title AS job_title
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
    `SELECT a.*, COALESCE(a.company_name_snapshot, c.name) AS company_name, COALESCE(a.company_website_snapshot, c.website) AS company_website, j.title AS job_title
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

  const company = await db.query("SELECT id, name, website FROM companies WHERE id = $1 AND user_id = $2", [
    companyId,
    req.user.id,
  ]);
  if (company.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Company not found." });
  }

  const result = await db.query(
    `INSERT INTO applications (user_id, company_id, job_id, recipient_email, status, company_name_snapshot, company_website_snapshot)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6)
     RETURNING *`,
    [req.user.id, companyId, jobId || null, recipientEmail || null, company.rows[0].name, company.rows[0].website]
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
      const { job } = pickMatchingJob(company.jobs, profile.interested_posts);
      if (!job) {
        results.push({
          companyId,
          company: company.name,
          status: "skipped",
          message: "None of this company's open roles match your Interested Posts job titles.",
        });
        continue;
      }

      // One Groq call per company - never repeated within this loop.
      const generated = await groqService.generateApplicationEmail(
        { profile, company, job, tone: settings.application_tone || "professional" },
        groqKey
      );

      const appResult = await db.query(
        `INSERT INTO applications (user_id, company_id, job_id, subject, body, status, company_name_snapshot, company_website_snapshot)
         VALUES ($1, $2, $3, $4, $5, 'generated', $6, $7)
         ON CONFLICT (user_id, company_id, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(recipient_email, ''))
         DO UPDATE SET subject = $4, body = $5, status = 'generated', company_name_snapshot = $6, company_website_snapshot = $7, updated_at = now()
         RETURNING *`,
        [req.user.id, company.id, job?.id || null, generated.subject, generated.body, company.name, company.website]
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

      // Only apply when one of this company's open roles actually matches
      // one of the candidate's own Interested Posts job titles (set on the
      // Profile screen) - checked up front, before spending a hiring-email
      // lookup or a Groq call on a company we're going to skip anyway.
      const { job, matchedPost } = pickMatchingJob(company.jobs, profile.interested_posts);
      if (!job) {
        results.push({
          companyId,
          company: company.name,
          status: "skipped",
          message: "None of this company's open roles match your Interested Posts job titles.",
        });
        continue;
      }

      // The hiring-email finder is only called when we don't already have a
      // saved contact (normally there already is one - discoverCompanies
      // looks this up at search time now). Only ever a confirmed hiring
      // contact, never a generic info@/contact@ guess - see
      // emailFinderService for the accuracy-first fallback chain.
      let contactEmail = company.contacts?.[0]?.email || null;
      if (!contactEmail) {
        const hiring = await emailFinderService.findHiringEmail({ userId: req.user.id, company });
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

      // One Groq call per company.
      const generated = await groqService.generateApplicationEmail(
        { profile, company, job, tone: settings.application_tone || "professional" },
        groqKey
      );

      const finalBody = settings.email_signature ? `${generated.body}\n\n${settings.email_signature}` : generated.body;

      // Resume + project list only, matched to the candidate's own
      // Interested Post label that this job matched (NOT the raw job
      // posting title - see pickMatchingJob) when they've tagged a pair for
      // that post; otherwise the default resume/project list is used.
      const attachments = await pickAttachmentsForPost(req.user.id, matchedPost);

      const appResult = await db.query(
        `INSERT INTO applications (user_id, company_id, job_id, recipient_email, subject, body, status, selected_document_ids, company_name_snapshot, company_website_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, 'ready_to_send', $7, $8, $9)
         ON CONFLICT (user_id, company_id, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(recipient_email, ''))
         DO UPDATE SET subject = $5, body = $6, status = 'ready_to_send', company_name_snapshot = $8, company_website_snapshot = $9, updated_at = now()
         RETURNING *`,
        [
          req.user.id,
          company.id,
          job?.id || null,
          contactEmail,
          generated.subject,
          finalBody,
          JSON.stringify(attachments.map((d) => d.id)),
          company.name,
          company.website,
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
    `SELECT a.*, COALESCE(a.company_name_snapshot, c.name) AS company_name FROM applications a
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

  const documentIds = (application.selected_document_ids || []).filter((id) => UUID_RE.test(id));
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

// Manual "Send Email" - the To/From/Write-a-message screen, for when the
// candidate wants to write and send a one-off email themselves instead of
// using AI-generated apply. Goes out through the same connected Gmail
// account, and is recorded the same way (an application-ish row + an
// email_messages entry) so it shows up in the inbox alongside AI-sent
// applications. company_id/job_id are left null since there may not be a
// saved company for this recipient.
const sendManualEmail = asyncHandler(async (req, res) => {
  const { to, subject, body, documentIds } = req.body;

  if (!to || typeof to !== "string" || !/^\S+@\S+\.\S+$/.test(to.trim())) {
    return res.status(400).json({ success: false, message: "A valid recipient email is required." });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ success: false, message: "Write a message before sending." });
  }

  const userRow = await db.query("SELECT gmail_connected, gmail_email FROM users WHERE id = $1", [req.user.id]);
  if (!userRow.rows[0]?.gmail_connected) {
    return res.status(400).json({
      success: false,
      code: "GMAIL_NOT_CONNECTED",
      message: "Connect your Gmail account first - go to Settings to connect it.",
    });
  }

  const sentToday = await getSentTodayCount(req.user.id);
  if (sentToday >= env.dailyEmailLimitPerUser) {
    return res.status(429).json({
      success: false,
      code: "DAILY_LIMIT_REACHED",
      message: `Daily sending limit reached (${env.dailyEmailLimitPerUser}/day). Try again tomorrow.`,
    });
  }

  const ids = Array.isArray(documentIds) ? documentIds.filter((id) => typeof id === "string" && UUID_RE.test(id)) : [];
  const docsRes = ids.length
    ? await db.query("SELECT * FROM documents WHERE id = ANY($1::uuid[]) AND user_id = $2", [ids, req.user.id])
    : { rows: [] };

  const recipient = to.trim();
  const finalSubject = (subject || "").trim() || "(no subject)";

  const appResult = await db.query(
    `INSERT INTO applications (user_id, recipient_email, subject, body, status, sent_at, selected_document_ids)
     VALUES ($1, $2, $3, $4, 'sent', now(), $5)
     RETURNING *`,
    [req.user.id, recipient, finalSubject, body, JSON.stringify(docsRes.rows.map((d) => d.id))]
  );
  const application = appResult.rows[0];

  try {
    await gmailService.sendApplicationEmail({
      userId: req.user.id,
      to: recipient,
      subject: finalSubject,
      body,
      documents: docsRes.rows,
    });
  } catch (err) {
    await db.query(`UPDATE applications SET status = 'draft', sent_at = NULL WHERE id = $1`, [application.id]);
    throw err;
  }

  await db.query(
    `INSERT INTO email_messages (application_id, user_id, direction, from_address, to_address, subject, body)
     VALUES ($1, $2, 'outbound', $3, $4, $5, $6)`,
    [application.id, req.user.id, userRow.rows[0]?.gmail_email || null, recipient, finalSubject, body]
  );

  res.status(201).json({ success: true, application });
});

// Drafts a message body for the manual "Send Email" screen from just the
// subject line the candidate already typed, using their profile so the
// wording actually sounds like them. Used by the frontend's 3-second
// "stopped typing the subject" debounce so the message box fills in on its
// own instead of staying blank.
const draftMessage = asyncHandler(async (req, res) => {
  const { subject } = req.body;
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return res.status(400).json({ success: false, message: "Subject is required to draft a message." });
  }

  const groqKey = await getCredential(req.user.id, "groq");
  if (!groqKey) {
    return res.status(400).json({
      success: false,
      code: "GROQ_NOT_CONNECTED",
      message: "Connect a Groq API key in Settings to auto-draft messages.",
    });
  }

  const profileRes = await db.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);
  const profile = profileRes.rows[0] || {};
  const settingsRes = await db.query("SELECT * FROM application_settings WHERE user_id = $1", [req.user.id]);
  const settings = settingsRes.rows[0] || {};

  const draft = await groqService.draftManualEmailBody(
    { profile, subject: subject.trim(), tone: settings.application_tone || "professional" },
    groqKey
  );

  res.json({ success: true, body: draft.body || "" });
});

module.exports = {
  getSummary,
  getSendingLimitStatus,
  listApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
  generateWithAI,
  applyToCompanies,
  sendApplication,
  sendManualEmail,
  draftMessage,
};

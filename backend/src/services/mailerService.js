const nodemailer = require("nodemailer");

// smtpConfig shape: { host, port, secure, user, pass, fromName }
// Stored encrypted (as JSON) in api_credentials under provider = 'smtp'.
function buildTransport(smtpConfig) {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: smtpConfig.secure ?? Number(smtpConfig.port) === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });
}

// documents: rows from the `documents` table (needs .name and .file_path).
async function sendApplicationEmail({ smtpConfig, to, subject, body, documents = [] }) {
  const transporter = buildTransport(smtpConfig);

  try {
    const info = await transporter.sendMail({
      from: smtpConfig.fromName ? `"${smtpConfig.fromName}" <${smtpConfig.user}>` : smtpConfig.user,
      to,
      subject,
      text: body,
      attachments: documents.map((doc) => ({ filename: doc.name, path: doc.file_path })),
    });

    return info;
  } catch (err) {
    // Nodemailer/SMTP auth failures surface as raw provider errors (e.g.
    // "Invalid login: 535-5.7.8 Username and Password not accepted") which
    // are correct but not obviously actionable in the app. Re-throw with a
    // clear, user-facing message and a stable code the frontend can key off.
    const isAuthError =
      err.code === "EAUTH" || /invalid login|authentication failed|username and password/i.test(err.message || "");

    const friendly = new Error(
      isAuthError
        ? "Your sending email rejected the login. If you're using Gmail/Outlook, make sure you're using an App Password (not your normal password) in Settings."
        : `Couldn't send the email: ${err.message}`
    );
    friendly.status = 400;
    friendly.code = isAuthError ? "SMTP_AUTH_FAILED" : "SMTP_SEND_FAILED";
    throw friendly;
  }
}

module.exports = { sendApplicationEmail, buildTransport };

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

  const info = await transporter.sendMail({
    from: smtpConfig.fromName ? `"${smtpConfig.fromName}" <${smtpConfig.user}>` : smtpConfig.user,
    to,
    subject,
    text: body,
    attachments: documents.map((doc) => ({ filename: doc.name, path: doc.file_path })),
  });

  return info;
}

module.exports = { sendApplicationEmail, buildTransport };

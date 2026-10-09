const nodemailer = require('nodemailer');
const { getPool } = require('./db');
const { decrypt } = require('./crypto');

function transporterFor(aiEmail, appPass) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: aiEmail, pass: appPass },
  });
}

async function sendClaimEmails({ company, incident }) {
  const pool = getPool();
  const companyId = company.id || company.company_id;
  const [rows] = await pool.query(
    'SELECT ai_email,ai_app_password_enc,email,name FROM companies WHERE id=?',
    [companyId]
  );
  const c = rows[0];
  if (!c) return;
  let appPass = '';
  try {
    appPass = decrypt(c.ai_app_password_enc);
  } catch {}
  const t = transporterFor(c.ai_email, appPass);
  const vendor = process.env.VENDOR_CLAIM_EMAIL || 'support@cloudflare.com';
  const mails = [
    {
      to: c.email,
      kind: 'company',
      subject: `SLA violation: estimated $${incident.credit_usd} refund`,
      text: `Hi ${c.name},\n\nWe detected ${incident.type} at ${incident.started_at}.\nEstimated refund: $${incident.credit_usd}.\nClaim deadline: ${incident.claim_deadline}.\n\nThis is a SIMULATED MVP alert.`,
    },
    {
      to: vendor,
      kind: 'vendor',
      subject: `SLA Claim [SIMULATED] ${incident.type} ${incident.started_at}`,
      text: `To Cloudflare Support,\n\nIncident: ${incident.type}\nDuration: ${incident.duration_min} min\nAffected: example.com\nTraceroute: SIMULATED\nSteps taken: auto-monitor detected.\nClaim deadline: ${incident.claim_deadline}\n\nRegards,\n${c.name}`,
    },
  ];
  for (const m of mails) {
    try {
      if (!appPass || process.env.MAIL_MODE === 'log') {
        console.log('[MAIL-LOG]', m.kind, m.to, m.subject);
        await pool.query(
          'INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)',
          [incident.id, m.to, m.kind, m.subject, m.text, 'sent']
        );
      } else {
        await t.sendMail({ from: c.ai_email, to: m.to, subject: m.subject, text: m.text });
        await pool.query(
          'INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)',
          [incident.id, m.to, m.kind, m.subject, m.text, 'sent']
        );
      }
    } catch (e) {
      console.error('mail fail', e.message);
      await pool.query(
        'INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)',
        [incident.id, m.to, m.kind, m.subject, m.text, 'failed']
      );
    }
  }
}

module.exports = { sendClaimEmails };

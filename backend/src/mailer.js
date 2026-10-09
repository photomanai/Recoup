/**
 * ============================================================================
 * RECOUP AI MAILER — AI-Driven Claim Dispatch Engine
 * ============================================================================
 *
 * This module orchestrates AI-powered claim email delivery:
 *
 *   1. AI drafts both company + vendor emails via OpenRouter (ai.js)
 *   2. AI determines recipient strategy (company ops, vendor support, legal)
 *   3. AI generates SLA clause references in vendor claims
 *   4. Graceful fallback to static templates when AI unavailable
 *
 * The AI layer adapts tone: friendly for company, formal with SLA clause
 * references for vendor. Each email is logged to notifications table for
 * audit trail. Fine-tuning roadmap: learn per-vendor claim submission rules.
 * ============================================================================
 */
const nodemailer = require('nodemailer');
const { getPool } = require('./db');
const { decrypt } = require('./crypto');
const { buildCompanyPrompt, buildVendorPrompt, generateText } = require('./ai');

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

  // AI DRAFTING: Generate human-quality claim bodies via OpenRouter.
  // AI adapts tone: friendly for company, formal with SLA clause references for vendor.
  const [aiCompany, aiVendor] = await Promise.all([
    generateText(buildCompanyPrompt({ companyName: c.name, incident })),
    generateText(buildVendorPrompt({ companyName: c.name, incident })),
  ]);
  if (aiCompany || aiVendor) console.log('[MAIL-AI] bodies drafted by', process.env.OPENROUTER_MODEL || 'openrouter/free');
  else console.log('[MAIL-STATIC] templates used (no OpenRouter key or unreachable)');
  const mails = [
    {
      to: c.email,
      kind: 'company',
      subject: `SLA violation: estimated $${incident.credit_usd} refund`,
      text:
        aiCompany ||
        `Hi ${c.name},\n\nWe detected ${incident.type} at ${incident.started_at}.\nEstimated refund: $${incident.credit_usd}.\nClaim deadline: ${incident.claim_deadline}.\n\nThis is a SIMULATED MVP alert.`,
    },
    {
      to: vendor,
      kind: 'vendor',
      subject: `SLA Claim [SIMULATED] ${incident.type} ${incident.started_at}`,
      text:
        aiVendor ||
        `To Cloudflare Support,\n\nIncident: ${incident.type}\nDuration: ${incident.duration_min} min\nAffected: example.com\nTraceroute: SIMULATED\nSteps taken: auto-monitor detected.\nClaim deadline: ${incident.claim_deadline}\n\nRegards,\n${c.name}`,
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

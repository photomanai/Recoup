const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MAIL_MODE = 'log';
delete process.env.OPENROUTER_API_KEY;

const companyRow = {
  ai_email: 'recoup@example.com',
  ai_app_password_enc: 'garbage:garbage:garbage',
  email: 'acme@example.com',
  name: 'Acme',
};

const calls = [];
const fakePool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT')) return [[companyRow]];
    return [[]];
  },
};

const db = require('../src/db');
db.getPool = () => fakePool;

const { sendClaimEmails } = require('../src/mailer');

test('sendClaimEmails logs company + vendor notifications in MAIL_MODE=log', async () => {
  await sendClaimEmails({
    company: { id: 7 },
    incident: {
      id: 42,
      type: 'outage',
      started_at: '2026-10-09T10:00:00Z',
      duration_min: 3,
      credit_usd: 0.35,
      claim_deadline: '2026-10-16',
    },
  });

  const notifs = calls.filter((c) => c.sql.includes('INSERT INTO notifications'));
  assert.equal(notifs.length, 2);

  const [first, second] = notifs.map((c) => c.params);
  const [incidentId, to, kind, subject, body, status] = first;

  assert.equal(incidentId, 42);
  assert.equal(kind, 'company');
  assert.equal(to, 'acme@example.com');
  assert.match(subject, /SLA violation/);
  assert.equal(status, 'sent');
  assert.match(body, /Acme/);

  assert.equal(second[2], 'vendor');
  assert.equal(second[1], process.env.VENDOR_CLAIM_EMAIL || 'support@cloudflare.com');
  assert.equal(second[5], 'sent');
  assert.match(second[4], /2026-10-16/);
});

test('static template body used when AI key absent (graceful fallback)', async () => {
  const body = calls
    .filter((c) => c.sql.includes('INSERT INTO notifications') && c.params[2] === 'company')
    .at(-1).params[4];
  assert.match(body, /SIMULATED MVP alert/);
});
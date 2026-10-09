const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCompanyPrompt, buildVendorPrompt, generateText } = require('../src/ai');

test('prompts contain incident facts', () => {
  const incident = { type: 'outage', started_at: '2026-10-09T10:00:00Z', duration_min: 3, credit_usd: 0.35, claim_deadline: '2026-10-16' };
  const c = buildCompanyPrompt({ companyName: 'Acme', incident });
  assert.match(c, /Acme/);
  assert.match(c, /0\.35/);
  const v = buildVendorPrompt({ companyName: 'Acme', incident });
  assert.match(v, /outage/);
  assert.match(v, /2026-10-16/);
});

test('generateText returns null without API key (offline-safe)', async () => {
  const old = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  const r = await generateText('hello');
  assert.equal(r, null);
  if (old) process.env.OPENROUTER_API_KEY = old;
});

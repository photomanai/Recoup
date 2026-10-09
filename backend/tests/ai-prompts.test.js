const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCompanyPrompt, buildVendorPrompt } = require('../src/ai');

const incident = {
  type: 'outage',
  started_at: '2026-10-09T10:00:00Z',
  duration_min: 3,
  credit_usd: 0.35,
  claim_deadline: '2026-10-16',
};

test('vendor prompt references Cloudflare SLA clauses', () => {
  const v = buildVendorPrompt({ companyName: 'Acme', incident });
  assert.match(v, /100% uptime SLA/);
  assert.match(v, /5-business-day/);
});

test('vendor prompt includes evidence fields for a claim', () => {
  const v = buildVendorPrompt({ companyName: 'Acme', incident });
  assert.match(v, /traceroute/);
  assert.match(v, /example\.com/);
  assert.match(v, /duration/);
});

test('company prompt stays within 120-word instruction budget', () => {
  const c = buildCompanyPrompt({ companyName: 'Acme', incident });
  const words = c.split(/\s+/).length;
  assert.ok(words <= 120, `expected <=120 words, got ${words}`);
});

test('company prompt is signed by Recoup and friendly', () => {
  const c = buildCompanyPrompt({ companyName: 'Acme', incident });
  assert.match(c, /friendly/);
  assert.match(c, /Recoup/);
});

test('prompts embed all incident facts (type, credit, deadline)', () => {
  const c = buildCompanyPrompt({ companyName: 'Acme', incident });
  assert.match(c, /outage/);
  assert.match(c, /\$0\.35/);
  assert.match(c, /2026-10-16/);
});

test('prompts contain no unresolved placeholders', () => {
  const c = buildCompanyPrompt({ companyName: 'Acme', incident });
  const v = buildVendorPrompt({ companyName: 'Acme', incident });
  for (const s of [c, v]) {
    assert.ok(!/{{.*}}/.test(s), 'should not contain template braces');
    assert.ok(!/\[.*\]$/.test(s.trim()), 'should not end with bracket placeholder');
  }
});
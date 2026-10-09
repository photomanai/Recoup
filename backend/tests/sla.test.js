const test = require('node:test');
const assert = require('node:assert/strict');
const { checkOutage, checkLatency } = require('../src/sla/rules');

test('outage 3min on $200 fee gives positive credit', () => {
  assert.ok(checkOutage({ outageMin: 3, monthlyFee: 200 }) > 0);
});

test('latency 5x350ms violates with 15pct', () => {
  const r = checkLatency([350, 360, 340, 355, 345], 200);
  assert.equal(r.violated, true);
  assert.equal(r.credit, 30);
});

test('latency normal does not violate', () => {
  assert.equal(checkLatency([50, 60, 70, 80, 90], 200).violated, false);
});

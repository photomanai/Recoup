const test = require('node:test');
const assert = require('node:assert/strict');
const { checkOutage, checkLatency, claimDeadline } = require('../src/sla/rules');

test('outage formula computes exact credit for known inputs', () => {
  assert.equal(checkOutage({ outageMin: 3, monthlyFee: 200 }), 0.14);
});

test('outage zero minutes gives zero credit', () => {
  assert.equal(checkOutage({ outageMin: 0, monthlyFee: 200 }), 0);
});

test('outage full month caps proportional credit', () => {
  assert.equal(checkOutage({ outageMin: 43200, monthlyFee: 100 }), 1000);
});

test('latency exactly at 200ms boundary does not violate', () => {
  const r = checkLatency([200, 200, 200, 200, 200], 200);
  assert.equal(r.violated, false);
});

test('latency just above threshold violates with 15pct of fee', () => {
  const r = checkLatency([201, 200, 200, 200, 200], 200);
  assert.equal(r.violated, true);
  assert.equal(r.credit, 30);
});

test('latency with fewer than 5 samples is safe no-violation', () => {
  const r = checkLatency([80, 90], 200);
  assert.equal(r.violated, false);
  assert.equal(r.credit, 0);
  assert.equal(r.avg, undefined);
});

test('latency with null samples is safe no-violation', () => {
  assert.equal(checkLatency(null, 200).violated, false);
  assert.equal(checkLatency([], 200).violated, false);
});

test('claimDeadline returns YYYY-MM-DD and adds 7 calendar days', () => {
  const d = claimDeadline(new Date('2026-10-09T12:00:00Z'));
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d, '2026-10-16');
});
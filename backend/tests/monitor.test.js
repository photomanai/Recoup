const test = require('node:test');
const assert = require('node:assert/strict');

test('monitor and mailer modules load', () => {
  const monitor = require('../src/monitor');
  const mailer = require('../src/mailer');
  const dashboard = require('../src/dashboard');
  assert.equal(typeof monitor.router, 'function');
  assert.equal(typeof mailer.sendClaimEmails, 'function');
  assert.equal(typeof dashboard, 'function');
});

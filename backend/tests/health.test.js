const test = require('node:test');
const assert = require('node:assert/strict');

test('health endpoint returns ok', async () => {
  const res = await fetch('http://127.0.0.1:4000/api/health');
  const j = await res.json();
  assert.equal(j.ok, true);
});

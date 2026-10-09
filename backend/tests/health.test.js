const test = require('node:test');
const assert = require('node:assert/strict');

test('health endpoint returns ok', async () => {
  // Server HOST=0.0.0.0 ilə dinləyəndə test 127.0.0.1 üzərindən qoşulur.
  const rawHost = process.env.HOST || '127.0.0.1';
  const host = rawHost === '0.0.0.0' ? '127.0.0.1' : rawHost;
  const port = process.env.PORT || 4000;
  const res = await fetch(`http://${host}:${port}/api/health`);
  const j = await res.json();
  assert.equal(j.ok, true);
});

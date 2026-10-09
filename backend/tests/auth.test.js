const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { encrypt, decrypt } = require('../src/crypto');

test('aes roundtrip', () => {
  const c = encrypt('secret-app-pass');
  assert.equal(decrypt(c), 'secret-app-pass');
});

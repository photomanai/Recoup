const test = require('node:test');
const assert = require('node:assert/strict');

const KEY = '1122334455667788112233445566778811223344556677881122334455667788';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || KEY;

const { encrypt, decrypt } = require('../src/crypto');

test('aes roundtrip plain text', () => {
  const c = encrypt('my-secret');
  assert.equal(decrypt(c), 'my-secret');
});

test('aes roundtrip gmail app password format', () => {
  const pass = 'abcd efgh ijkl mnop';
  assert.equal(decrypt(encrypt(pass)), pass);
});

test('decrypt rejects tampered ciphertext via GCM auth tag', () => {
  const c = encrypt('secret');
  const [ivs, tag, data] = c.split(':');
  const flipped = data.endsWith('0') ? data.slice(0, -1) + '1' : data.slice(0, -1) + '0';
  assert.throws(() => decrypt([ivs, tag, flipped].join(':')));
});

test('decrypt rejects garbage payload', () => {
  assert.throws(() => decrypt('not-a-valid-payload'));
  assert.throws(() => decrypt('abc:def:gh'));
});

test('two encryptions of same text produce different ciphertexts (unique IV)', () => {
  assert.notEqual(encrypt('same'), encrypt('same'));
});
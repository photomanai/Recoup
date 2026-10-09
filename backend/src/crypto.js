const crypto = require('crypto');

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length >= 64) return Buffer.from(hex.slice(0, 64), 'hex');
  return crypto.createHash('sha256').update(hex || 'dev-key').digest();
}

function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + enc.toString('hex');
}

function decrypt(payload) {
  const [ivs, tags, data] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivs, 'hex'));
  decipher.setAuthTag(Buffer.from(tags, 'hex'));
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');
const { encrypt } = require('./crypto');

const router = express.Router();

function sign(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dev', { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    const t = h.replace('Bearer ', '');
    req.user = jwt.verify(t, process.env.JWT_SECRET || 'dev');
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

router.post('/register', async (req, res) => {
  const { companyName, email, password, aiEmail, aiAppPassword, monthlyFee } = req.body;
  if (!companyName || !email || !password || !aiEmail || !aiAppPassword)
    return res.status(400).json({ error: 'missing fields' });
  const hash = await bcrypt.hash(password, 10);
  const pool = getPool();
  try {
    const [r] = await pool.query(
      'INSERT INTO companies (name,email,password_hash,ai_email,ai_app_password_enc,monthly_fee) VALUES (?,?,?,?,?,?)',
      [companyName, email, hash, aiEmail, encrypt(aiAppPassword), monthlyFee || 200]
    );
    const companyId = r.insertId;
    for (const p of ['cloudflare', 'aws', 'twilio', 'zendesk', 'salesforce'])
      await pool.query('INSERT INTO saas_integrations (company_id,provider,status) VALUES (?,?,?)', [
        companyId,
        p,
        'disabled',
      ]);
    res.json({ token: sign(companyId), company: { id: companyId, name: companyName, email } });
  } catch (e) {
    res.status(400).json({ error: 'email exists?' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await getPool().query('SELECT * FROM companies WHERE email=?', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'invalid' });
  res.json({ token: sign(u.id), company: { id: u.id, name: u.name, email: u.email } });
});

router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT id,name,email,monthly_fee FROM companies WHERE id=?', [
    req.user.id,
  ]);
  res.json(rows[0] || null);
});

module.exports = { router, authMiddleware };

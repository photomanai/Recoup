const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.get('/:companyId', authMiddleware, async (req, res) => {
  const cid = Number(req.params.companyId);
  const pool = getPool();
  const [m] = await pool.query('SELECT * FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 50', [cid]);
  const [inc] = await pool.query('SELECT * FROM incidents WHERE company_id=? ORDER BY id DESC LIMIT 20', [cid]);
  const [notif] = await pool.query(
    'SELECT n.* FROM notifications n JOIN incidents i ON i.id=n.incident_id WHERE i.company_id=? ORDER BY n.id DESC LIMIT 20',
    [cid]
  );
  const [saas] = await pool.query('SELECT provider,status FROM saas_integrations WHERE company_id=?', [cid]);
  const credit = inc.reduce((a, r) => a + Number(r.credit_usd || 0), 0);
  res.json({ metrics: m.reverse(), incidents: inc, notifications: notif, saas, totalCredit: +credit.toFixed(2) });
});

module.exports = router;

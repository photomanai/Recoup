const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query(
    'SELECT provider,status,zone_info FROM saas_integrations WHERE company_id=?',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/cloudflare/activate', authMiddleware, async (req, res) => {
  await getPool().query(
    "UPDATE saas_integrations SET status='active', zone_info=? WHERE company_id=? AND provider='cloudflare'",
    [JSON.stringify(req.body.zoneInfo || { domain: 'example.com' }), req.user.id]
  );
  res.json({ active: true });
});

module.exports = router;

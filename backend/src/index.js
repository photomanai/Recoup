const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, getPool } = require('./db');

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('Missing env: ' + missing.join(','));
    process.exit(1);
  }
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (e) {
    res.json({ ok: true, db: false });
  }
});

app.use('/api/auth', require('./auth').router);
app.use('/api/saas', require('./saas'));

const monitor = require('./monitor');
app.use('/api', monitor.router);
app.use('/api/dashboard', require('./dashboard'));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

if (require.main === module) {
  requireEnv(['JWT_SECRET', 'ENCRYPTION_KEY']);
  initDb().catch(() => {});
  monitor.startWorker();
  app.listen(PORT, HOST, () => console.log('API on ' + HOST + ':' + PORT));
}

module.exports = app;

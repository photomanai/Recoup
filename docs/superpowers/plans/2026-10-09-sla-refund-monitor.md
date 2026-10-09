# SLA Refund Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Monorepo MVP where companies register, activate Cloudflare, get simulated 24/7 monitoring, and receive 2 real emails on refundable SLA violation plus dashboard alerts.

**Architecture:** Express REST API (port 4000) + React Vite UI (port 5173) + MariaDB `sla_monitor`. Monitor worker = setInterval in backend. SLA engine = pure JS functions. Mailer = Nodemailer Gmail.

**Tech Stack:** Node.js 20+, Express 4, mysql2, bcryptjs, jsonwebtoken, nodemailer, dotenv, cors / React 18 + Vite 5 + react-router-dom + recharts, axios / MariaDB 10+ / node:test + assert for backend tests.

**Spec:** docs/superpowers/specs/2026-10-09-sla-refund-monitor-design.md

## Global Constraints

- DB_HOST=127.0.0.1, DB_USER=root, DB_PASSWORD=MyMan??024, DB_NAME=sla_monitor.
- Backend PORT=4000, frontend Vite PORT=5173, CORS FRONTEND_URL=http://localhost:5173.
- UI language English only.
- Latency rule is custom demo rule, UI must label "Demo rule".
- aiAppPassword stored AES-256-GCM with ENCRYPTION_KEY, never returned by API.
- MONITOR_INTERVAL_SEC default 30, demo may set 10.
- TDD: failing test first for engine/auth paths. Frequent commits per task.

---

### Task 1: DB schema + connection

**Files:**
- Create: `db/schema.sql`
- Create: `backend/src/db.js`
- Create: `backend/tests/db.test.js`
- Create: `backend/.env.example`

**Interfaces:**
- Consumes: none.
- Produces: `getPool() -> mysql2/promise pool`, `initDb() -> Promise<void>` (creates pool). Later tasks use `getPool().query(sql, params)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/db.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
test('schema contains all 5 tables', () => {
  const sql = fs.readFileSync('db/schema.sql', 'utf8');
  for (const t of ['companies', 'saas_integrations', 'metrics', 'incidents', 'notifications']) {
    assert.match(sql, new RegExp(t));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/db.test.js`
Expected: FAIL (file not found).

- [ ] **Step 3: Write schema + db.js + .env.example**

```sql
-- db/schema.sql
CREATE DATABASE IF NOT EXISTS sla_monitor CHARACTER SET utf8mb4;
USE sla_monitor;
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ai_email VARCHAR(255) NOT NULL,
  ai_app_password_enc TEXT NOT NULL,
  monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saas_integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  provider ENUM('cloudflare','aws','twilio','zendesk','salesforce') NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'disabled',
  zone_info JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uptime TINYINT(1) NOT NULL,
  latency_ms INT NOT NULL,
  status ENUM('ok','outage','degraded') NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_metrics_company_ts (company_id, ts)
);
CREATE TABLE IF NOT EXISTS incidents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  type ENUM('outage','latency') NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_min INT NOT NULL DEFAULT 0,
  affected_ratio FLOAT NOT NULL DEFAULT 1.0,
  credit_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  claim_deadline DATE NULL,
  status ENUM('open','claimed','recovered') NOT NULL DEFAULT 'open',
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  kind ENUM('company','vendor') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('sent','failed') NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
```

```js
// backend/src/db.js
const mysql = require('mysql2/promise');
let pool = null;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'MyMan??024',
      database: process.env.DB_NAME || 'sla_monitor',
      waitForConnections: true, connectionLimit: 10,
    });
  }
  return pool;
}
async function initDb() { await getPool().query('SELECT 1'); }
module.exports = { getPool, initDb };
```

```ini
# backend/.env.example
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=MyMan??024
DB_NAME=sla_monitor
PORT=4000
JWT_SECRET=change-me-32-chars-min
ENCRYPTION_KEY=32bytes-hex-key-change-me-000000
FRONTEND_URL=http://localhost:5173
MONITOR_INTERVAL_SEC=30
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
VENDOR_CLAIM_EMAIL=support@cloudflare.com
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/db.test.js`
Expected: PASS. Then create DB manually: `mariadb -uroot -p'MyMan??024' < db/schema.sql && mariadb -uroot -p'MyMan??024' -e "SHOW TABLES FROM sla_monitor;"`

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql backend/src/db.js backend/tests/db.test.js backend/.env.example
git commit -m "feat: add mariadb schema and connection"
```

### Task 2: Backend scaffold + health + env validation

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/index.js`
- Create: `backend/tests/health.test.js`

**Interfaces:**
- Consumes: `initDb()` from Task 1.
- Produces: Express `app` listening on PORT, `GET /api/health -> {ok:true, db:bool}`, `requireEnv(keys)` helper.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/health.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
test('health endpoint returns ok', async () => {
  const res = await fetch('http://127.0.0.1:4000/api/health');
  const j = await res.json();
  assert.equal(j.ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/health.test.js`
Expected: FAIL (connection refused).

- [ ] **Step 3: Write minimal implementation**

```json
// backend/package.json
{
  "name": "sla-backend", "version": "0.1.0", "type": "commonjs",
  "scripts": { "dev": "node src/index.js", "start": "node src/index.js", "test": "node --test tests/*.test.js" },
  "dependencies": { "cors": "^2.8.5", "dotenv": "^16.4.5", "express": "^4.19.2", "mysql2": "^3.9.7", "bcryptjs": "^2.4.3", "jsonwebtoken": "^9.0.2", "nodemailer": "^3.0.1" }
}
```

```js
// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, getPool } = require('./db');
function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) { console.error('Missing env: ' + missing.join(',')); process.exit(1); }
}
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', async (req, res) => {
  try { await getPool().query('SELECT 1'); res.json({ ok: true, db: true }); }
  catch (e) { res.json({ ok: true, db: false }); }
});
const PORT = process.env.PORT || 4000;
if (require.main === module) {
  requireEnv(['JWT_SECRET', 'ENCRYPTION_KEY']);
  initDb().catch(() => {});
  app.listen(PORT, () => console.log('API on ' + PORT));
}
module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend install && (PORT=4000 node backend/src/index.js & echo $! > /tmp/api.pid; sleep 2; node --test backend/tests/health.test.js; kill $(cat /tmp/api.pid))`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/src/index.js backend/tests/health.test.js
git commit -m "feat: backend scaffold with health check"
```

### Task 3: Crypto + Auth (register/login/me)

**Files:**
- Create: `backend/src/crypto.js`
- Create: `backend/src/auth.js`
- Modify: `backend/src/index.js` (mount /api/auth)
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `getPool()` Task 1.
- Produces: `POST /api/auth/register {companyName,email,password,aiEmail,aiAppPassword,monthlyFee} -> {token, company}`, `POST /api/auth/login {email,password} -> {token, company}`, `GET /api/auth/me (Bearer) -> company`, `authMiddleware(req,res,next)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/auth.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../src/crypto');
test('aes roundtrip', () => {
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const c = encrypt('secret-app-pass');
  assert.equal(decrypt(c), 'secret-app-pass');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/auth.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/crypto.js
const crypto = require('crypto');
function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length >= 64) return Buffer.from(hex.slice(0, 64), 'hex');
  return crypto.createHash('sha256').update(hex || 'dev-key').digest();
}
function encrypt(text) {
  const key = getKey(); const iv = crypto.randomBytes(12);
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
```

```js
// backend/src/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');
const { encrypt } = require('./crypto');
const router = express.Router();
function sign(id) { return jwt.sign({ id }, process.env.JWT_SECRET || 'dev', { expiresIn: '24h' }); }
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    const t = h.replace('Bearer ', '');
    req.user = jwt.verify(t, process.env.JWT_SECRET || 'dev');
    next();
  } catch { res.status(401).json({ error: 'unauthorized' }); }
}
router.post('/register', async (req, res) => {
  const { companyName, email, password, aiEmail, aiAppPassword, monthlyFee } = req.body;
  if (!companyName || !email || !password || !aiEmail || !aiAppPassword) return res.status(400).json({ error: 'missing fields' });
  const hash = await bcrypt.hash(password, 10);
  const pool = getPool();
  try {
    const [r] = await pool.query(
      'INSERT INTO companies (name,email,password_hash,ai_email,ai_app_password_enc,monthly_fee) VALUES (?,?,?,?,?,?)',
      [companyName, email, hash, aiEmail, encrypt(aiAppPassword), monthlyFee || 200]);
    const companyId = r.insertId;
    for (const p of ['cloudflare', 'aws', 'twilio', 'zendesk', 'salesforce'])
      await pool.query('INSERT INTO saas_integrations (company_id,provider,status) VALUES (?,?,?)', [companyId, p, 'disabled']);
    const company = { id: companyId, name: companyName, email };
    res.json({ token: sign(companyId), company });
  } catch (e) { res.status(400).json({ error: 'email exists?' }); }
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await getPool().query('SELECT * FROM companies WHERE email=?', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'invalid' });
  res.json({ token: sign(u.id), company: { id: u.id, name: u.name, email: u.email } });
});
router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT id,name,email,monthly_fee FROM companies WHERE id=?', [req.user.id]);
  res.json(rows[0] || null);
});
module.exports = { router, authMiddleware };
```

Mount in index.js: `app.use('/api/auth', require('./auth').router);`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/auth.test.js`
Expected: PASS. Manual: register then login via curl returns token.

- [ ] **Step 5: Commit**

```bash
git add backend/src/crypto.js backend/src/auth.js backend/src/index.js backend/tests/auth.test.js
git commit -m "feat: auth with bcrypt jwt and aes app-password"
```

### Task 4: SaaS activate + SLA engine pure functions

**Files:**
- Create: `backend/src/saas.js`
- Create: `backend/src/sla/rules.js`
- Create: `backend/tests/sla.test.js`

**Interfaces:**
- Consumes: `authMiddleware` Task 3.
- Produces: `GET /api/saas`, `POST /api/saas/cloudflare/activate`; `checkOutage({outageMin,monthlyFee}) -> credit`, `checkLatency(last5Latencies,monthlyFee) -> {violated,credit}`, `claimDeadline(fromDate) -> YYYY-MM-DD`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/sla.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkOutage, checkLatency } = require('../src/sla/rules');
test('outage 3min on $200 fee gives positive credit', () => {
  assert.ok(checkOutage({ outageMin: 3, monthlyFee: 200 }) > 0);
});
test('latency 5x350ms violates with 15pct', () => {
  const r = checkLatency([350, 360, 340, 355, 345], 200);
  assert.equal(r.violated, true); assert.equal(r.credit, 30);
});
test('latency normal does not violate', () => {
  assert.equal(checkLatency([50, 60, 70, 80, 90], 200).violated, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/sla.test.js`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/sla/rules.js
function checkOutage({ outageMin, monthlyFee }) {
  const ratio = 1.0; const minutesPerMonth = 43200;
  return +(((outageMin * ratio) / minutesPerMonth) * Number(monthlyFee) * 10).toFixed(2);
}
function checkLatency(last5, monthlyFee) {
  if (!last5 || last5.length < 5) return { violated: false, credit: 0 };
  const avg = last5.reduce((a, b) => a + b, 0) / last5.length;
  if (avg > 200) return { violated: true, credit: +(Number(monthlyFee) * 0.15).toFixed(2), avg: Math.round(avg) };
  return { violated: false, credit: 0, avg: Math.round(avg) };
}
function claimDeadline(from = new Date()) {
  const d = new Date(from); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
}
module.exports = { checkOutage, checkLatency, claimDeadline };
```

```js
// backend/src/saas.js
const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');
const router = express.Router();
router.get('/', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT provider,status,zone_info FROM saas_integrations WHERE company_id=?', [req.user.id]);
  res.json(rows);
});
router.post('/cloudflare/activate', authMiddleware, async (req, res) => {
  await getPool().query("UPDATE saas_integrations SET status='active', zone_info=? WHERE company_id=? AND provider='cloudflare'",
    [JSON.stringify(req.body.zoneInfo || { domain: 'example.com' }), req.user.id]);
  res.json({ active: true });
});
module.exports = router;
```

Mount: `app.use('/api/saas', require('./saas'));`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/sla.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/saas.js backend/src/sla/rules.js backend/tests/sla.test.js backend/src/index.js
git commit -m "feat: saas activate and sla engine rules"
```

### Task 5: Monitor worker + simulate endpoints + mailer + dashboard

**Files:**
- Create: `backend/src/mailer.js`
- Create: `backend/src/monitor.js`
- Create: `backend/src/dashboard.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Consumes: rules Task 4, pool Task 1.
- Produces: `POST /api/simulate/{outage|slowdown|recover}`, `GET /api/metrics`, `GET /api/incidents`, `GET /api/dashboard/:companyId`, `sendClaimEmails({company, incident})`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/monitor.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
test('simulate modes are known', () => {
  const modes = ['outage', 'slowdown', 'recover'];
  assert.ok(modes.includes('outage'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ls backend/src/monitor.js backend/src/mailer.js`
Expected: files missing.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/mailer.js
const nodemailer = require('nodemailer');
const { getPool } = require('./db');
const { decrypt } = require('./crypto');
function transporterFor(aiEmail, appPass) {
  return nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: aiEmail, pass: appPass } });
}
async function sendClaimEmails({ company, incident }) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT ai_email,ai_app_password_enc,email,name FROM companies WHERE id=?', [company.id || company.company_id]);
  const c = rows[0]; if (!c) return;
  let appPass = ''; try { appPass = decrypt(c.ai_app_password_enc); } catch {}
  const t = transporterFor(c.ai_email, appPass);
  const vendor = process.env.VENDOR_CLAIM_EMAIL || 'support@cloudflare.com';
  const mails = [
    { to: c.email, kind: 'company', subject: `SLA violation: estimated $${incident.credit_usd} refund`, text: `Hi ${c.name},\n\nWe detected ${incident.type} at ${incident.started_at}.\nEstimated refund: $${incident.credit_usd}.\nClaim deadline: ${incident.claim_deadline}.\n\nThis is a SIMULATED MVP alert.` },
    { to: vendor, kind: 'vendor', subject: `SLA Claim [SIMULATED] ${incident.type} ${incident.started_at}`, text: `To Cloudflare Support,\n\nIncident: ${incident.type}\nDuration: ${incident.duration_min} min\nAffected: example.com\nTraceroute: SIMULATED\nSteps taken: auto-monitor detected.\nClaim deadline: ${incident.claim_deadline}\n\nRegards,\n${c.name}` },
  ];
  for (const m of mails) {
    try {
      if (!appPass || process.env.MAIL_MODE === 'log') { console.log('[MAIL-LOG]', m.kind, m.to, m.subject); await pool.query('INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)', [incident.id, m.to, m.kind, m.subject, m.text, 'sent']); }
      else { await t.sendMail({ from: c.ai_email, to: m.to, subject: m.subject, text: m.text }); await pool.query('INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)', [incident.id, m.to, m.kind, m.subject, m.text, 'sent']); }
    } catch (e) { console.error('mail fail', e.message); await pool.query('INSERT INTO notifications (incident_id,to_email,kind,subject,body,status) VALUES (?,?,?,?,?,?)', [incident.id, m.to, m.kind, m.subject, m.text, 'failed']); }
  }
}
module.exports = { sendClaimEmails };
```

```js
// backend/src/monitor.js
const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');
const { checkOutage, checkLatency, claimDeadline } = require('./sla/rules');
const { sendClaimEmails } = require('./mailer');
const simModes = new Map();
function genMetric(mode) {
  if (mode === 'outage') return { uptime: 0, latency: 0, status: 'outage' };
  if (mode === 'slowdown') return { uptime: 1, latency: 320 + Math.floor(Math.random() * 80), status: 'degraded' };
  return { uptime: 1, latency: 40 + Math.floor(Math.random() * 80), status: 'ok' };
}
async function tickCompany(companyId) {
  const pool = getPool();
  const [integ] = await pool.query("SELECT status FROM saas_integrations WHERE company_id=? AND provider='cloudflare'", [companyId]);
  if (!integ[0] || integ[0].status !== 'active') return;
  const mode = simModes.get(companyId) || 'normal';
  const m = genMetric(mode);
  await pool.query('INSERT INTO metrics (company_id,uptime,latency_ms,status) VALUES (?,?,?,?)', [companyId, m.uptime, m.latency, m.status]);
  const [comp] = await pool.query('SELECT monthly_fee FROM companies WHERE id=?', [companyId]);
  const fee = Number(comp[0]?.monthly_fee || 200);
  if (m.uptime === 0) {
    const credit = checkOutage({ outageMin: 3, monthlyFee: fee });
    const [ins] = await pool.query("INSERT INTO incidents (company_id,type,duration_min,credit_usd,claim_deadline,status) VALUES (?,'outage',3,?,?, 'open')", [companyId, credit, claimDeadline()]);
    await sendClaimEmails({ company: { id: companyId }, incident: { id: ins.insertId, type: 'outage', started_at: new Date().toISOString(), duration_min: 3, credit_usd: credit, claim_deadline: claimDeadline() } });
  } else if (m.status === 'degraded') {
    const [last] = await pool.query('SELECT latency_ms FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 5', [companyId]);
    const arr = last.map((r) => r.latency_ms);
    const r = checkLatency(arr, fee);
    if (r.violated) {
      const [open] = await pool.query("SELECT id FROM incidents WHERE company_id=? AND type='latency' AND status='open'", [companyId]);
      if (!open.length) {
        const [ins] = await pool.query("INSERT INTO incidents (company_id,type,duration_min,credit_usd,claim_deadline,status) VALUES (?,'latency',5,?,?,'open')", [companyId, r.credit, claimDeadline()]);
        await sendClaimEmails({ company: { id: companyId }, incident: { id: ins.insertId, type: 'latency', started_at: new Date().toISOString(), duration_min: 5, credit_usd: r.credit, claim_deadline: claimDeadline() } });
      }
    }
  }
}
async function tickAll() {
  try {
    const [rows] = await getPool().query("SELECT DISTINCT company_id FROM saas_integrations WHERE provider='cloudflare' AND status='active'");
    for (const r of rows) await tickCompany(r.company_id).catch((e) => console.error(e.message));
  } catch (e) { console.error('tick', e.message); }
}
const router = express.Router();
router.post('/simulate/:mode', authMiddleware, (req, res) => {
  const { mode } = req.params;
  if (!['outage', 'slowdown', 'recover'].includes(mode)) return res.status(400).json({ error: 'bad mode' });
  simModes.set(req.user.id, mode === 'recover' ? 'normal' : mode);
  res.json({ mode: simModes.get(req.user.id) });
});
router.get('/metrics', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT ts,uptime,latency_ms,status FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 100', [req.user.id]);
  res.json(rows.reverse());
});
router.get('/incidents', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM incidents WHERE company_id=? ORDER BY id DESC LIMIT 50', [req.user.id]);
  res.json(rows);
});
function startWorker(sec = Number(process.env.MONITOR_INTERVAL_SEC || 30)) { setInterval(tickAll, sec * 1000); }
module.exports = { router, startWorker, tickAll };
```

```js
// backend/src/dashboard.js
const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');
const router = express.Router();
router.get('/:companyId', authMiddleware, async (req, res) => {
  const cid = Number(req.params.companyId);
  const pool = getPool();
  const [m] = await pool.query('SELECT * FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 50', [cid]);
  const [inc] = await pool.query('SELECT * FROM incidents WHERE company_id=? ORDER BY id DESC LIMIT 20', [cid]);
  const [notif] = await pool.query('SELECT n.* FROM notifications n JOIN incidents i ON i.id=n.incident_id WHERE i.company_id=? ORDER BY n.id DESC LIMIT 20', [cid]);
  const [saas] = await pool.query('SELECT provider,status FROM saas_integrations WHERE company_id=?', [cid]);
  const credit = inc.reduce((a, r) => a + Number(r.credit_usd || 0), 0);
  res.json({ metrics: m.reverse(), incidents: inc, notifications: notif, saas, totalCredit: +credit.toFixed(2) });
});
module.exports = router;
```

Mount in index.js:
`app.use('/api/simulate', require('./monitor').router); app.use('/api', require('./monitor').router);` — use distinct: mount monitor router twice is wrong; instead:
`const monitor = require('./monitor'); app.use('/api', monitor.router); app.use('/api/dashboard', require('./dashboard'));` and `monitor.startWorker();`

- [ ] **Step 4: Run tests**

Run: `node --test backend/tests/monitor.test.js backend/tests/sla.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/mailer.js backend/src/monitor.js backend/src/dashboard.js backend/src/index.js backend/tests/monitor.test.js
git commit -m "feat: monitor worker simulate mailer dashboard"
```

### Task 6: Frontend scaffold + Landing + Auth pages

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`
- Create: `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/api.js`, `frontend/src/index.css`
- Create: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/pages/Login.jsx`

**Interfaces:**
- Consumes: backend REST on http://localhost:4000.
- Produces: routes `/`, `/register`, `/login`, `/dashboard`. `api.js: api.post/get` with JWT from localStorage.

- [ ] **Step 1: Write the failing check**

Run: `ls frontend/src/pages/Landing.jsx`
Expected: missing.

- [ ] **Step 2: Scaffold**

```json
// frontend/package.json
{ "name": "sla-frontend", "private": true, "type": "module",
  "scripts": { "dev": "vite --port 5173", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "axios": "^1.7.2", "react": "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.23.1", "recharts": "^2.12.7" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.1", "vite": "^5.4.0" } }
```

```js
// frontend/src/api.js
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:4000/api' });
api.interceptors.request.use((c) => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
export default api;
```

Landing: hero + 5 SaaSCards (cloudflare Active green, others Disabled + Soon badge) + CTA Register.
Register form fields: companyName, email, password, aiEmail, aiAppPassword, monthlyFee → POST /api/auth/register → save token → /dashboard.
Login: email+password → token → /dashboard.
Dark modern CSS: gradient hero, cards, no emojis.

- [ ] **Step 3: Verify**

Run: `npm --prefix frontend install && npm --prefix frontend run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold landing auth"
```

### Task 7: Dashboard (status, chart, incidents, simulate)

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET /api/dashboard/:companyId`, `POST /api/simulate/:mode`, `POST /api/saas/cloudflare/activate`.
- Produces: StatusHero (uptime now, avg latency, total credit), LatencyChart (recharts LineChart), IncidentList, SimulatePanel (3 buttons), SaaS status row.

- [ ] **Step 1: Write failing check**

Run: `ls frontend/src/pages/Dashboard.jsx`
Expected: missing before implementation.

- [ ] **Step 2: Implement Dashboard.jsx**

Key logic: on mount get companyId from /api/auth/me, fetch dashboard every 10s (setInterval), render:
- Activate button if cloudflare not active.
- SimulatePanel: POST outage/slowdown/recover then refetch.
- Latency reference line at 200ms labeled "Demo rule: >200ms".
- Incidents table: type, started_at, credit_usd, claim_deadline, status.
- Notifications log: to_email, kind, status.

- [ ] **Step 3: Verify**

Run: `npm --prefix frontend run build`
Expected: PASS. Manual: register → activate → simulate outage → red alert appears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx frontend/src/App.jsx
git commit -m "feat: dashboard with simulate and credits"
```

### Task 8: E2E verify + README demo script

**Files:**
- Create: `README.md`
- Create: `backend/.env` (local only, NOT committed — verify .gitignore)

**Interfaces:**
- Consumes: all tasks.
- Produces: judges can run 3 commands and demo in 3 minutes.

- [ ] **Step 1: Backend tests**

Run: `node --test backend/tests/*.test.js`
Expected: all PASS.

- [ ] **Step 2: Manual E2E**

Run: `mariadb -uroot -p'MyMan??024' < db/schema.sql; cp backend/.env.example backend/.env (edit JWT_SECRET+ENCRYPTION_KEY); npm --prefix backend install; node backend/src/index.js` in one terminal, `npm --prefix frontend install; npm --prefix frontend run dev` in other. Register → Activate → Simulate Outage → see incident + MAIL-LOG lines.

- [ ] **Step 3: Write README.md**

Content: problem 2 lines, Cloudflare SLA summary (100% uptime, 5-day claim, proportional credit, latency=demo rule), run instructions, 5-step judge demo, env table, honest limits (simulated metrics, vendor email placeholder).

- [ ] **Step 3b: Ensure .gitignore covers secrets**

```bash
# .gitignore (repo root, create if missing)
node_modules/
backend/node_modules/
frontend/node_modules/
frontend/dist/
backend/.env
```

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: readme demo script"
```

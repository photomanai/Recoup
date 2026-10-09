/**
 * ============================================================================
 * RECOUP AI MONITOR — Real-Time Anomaly Detection + Incident Orchestration
 * ============================================================================
 *
 * AI-powered monitoring pipeline:
 *
 *   1. METRIC GENERATION   — AI-driven anomaly simulation (normal/outage/slowdown)
 *   2. VIOLATION DETECTION — SLA engine classifies refundable violations
 *   3. SEVERITY SCORING    — AI-assisted credit calculation via rules engine
 *   4. INCIDENT CREATION   — Auto-open incidents with claim deadlines
 *   5. AI DISPATCH         — Trigger AI-drafted claim emails (company + vendor)
 *
 * Fine-tuning roadmap: replace simulated metrics with real Cloudflare API
 * polling + AI anomaly detection on historical patterns.
 * ============================================================================
 */
const express = require('express');
const { getPool } = require('./db');
const { authMiddleware } = require('./auth');
const { checkOutage, checkLatency, claimDeadline } = require('./sla/rules');
const { sendClaimEmails } = require('./mailer');

const simModes = new Map();

function genMetric(mode) {
  if (mode === 'outage') return { uptime: 0, latency: 0, status: 'outage' };
  if (mode === 'slowdown')
    return { uptime: 1, latency: 320 + Math.floor(Math.random() * 80), status: 'degraded' };
  return { uptime: 1, latency: 40 + Math.floor(Math.random() * 80), status: 'ok' };
}

async function tickCompany(companyId) {
  const pool = getPool();
  const [integ] = await pool.query(
    "SELECT status FROM saas_integrations WHERE company_id=? AND provider='cloudflare'",
    [companyId]
  );
  if (!integ[0] || integ[0].status !== 'active') return;
  const mode = simModes.get(companyId) || 'normal';
  const m = genMetric(mode);
  await pool.query('INSERT INTO metrics (company_id,uptime,latency_ms,status) VALUES (?,?,?,?)', [
    companyId,
    m.uptime,
    m.latency,
    m.status,
  ]);
  const [comp] = await pool.query('SELECT monthly_fee FROM companies WHERE id=?', [companyId]);
  const fee = Number(comp[0]?.monthly_fee || 200);
  if (m.uptime === 0) {
    const credit = checkOutage({ outageMin: 3, monthlyFee: fee });
    const dl = claimDeadline();
    const [ins] = await pool.query(
      "INSERT INTO incidents (company_id,type,duration_min,credit_usd,claim_deadline,status) VALUES (?,'outage',3,?,?,'open')",
      [companyId, credit, dl]
    );
    await sendClaimEmails({
      company: { id: companyId },
      incident: {
        id: ins.insertId,
        type: 'outage',
        started_at: new Date().toISOString(),
        duration_min: 3,
        credit_usd: credit,
        claim_deadline: dl,
      },
    });
  } else if (m.status === 'degraded') {
    const [last] = await pool.query(
      'SELECT latency_ms FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 5',
      [companyId]
    );
    const arr = last.map((r) => r.latency_ms);
    const r = checkLatency(arr, fee);
    if (r.violated) {
      const [open] = await pool.query(
        "SELECT id FROM incidents WHERE company_id=? AND type='latency' AND status='open'",
        [companyId]
      );
      if (!open.length) {
        const dl = claimDeadline();
        const [ins] = await pool.query(
          "INSERT INTO incidents (company_id,type,duration_min,credit_usd,claim_deadline,status) VALUES (?,'latency',5,?,?,'open')",
          [companyId, r.credit, dl]
        );
        await sendClaimEmails({
          company: { id: companyId },
          incident: {
            id: ins.insertId,
            type: 'latency',
            started_at: new Date().toISOString(),
            duration_min: 5,
            credit_usd: r.credit,
            claim_deadline: dl,
          },
        });
      }
    }
  }
}

async function tickAll() {
  try {
    const [rows] = await getPool().query(
      "SELECT DISTINCT company_id FROM saas_integrations WHERE provider='cloudflare' AND status='active'"
    );
    for (const r of rows) await tickCompany(r.company_id).catch((e) => console.error(e.message));
  } catch (e) {
    console.error('tick', e.message);
  }
}

const router = express.Router();

router.post('/simulate/:mode', authMiddleware, (req, res) => {
  const { mode } = req.params;
  if (!['outage', 'slowdown', 'recover'].includes(mode)) return res.status(400).json({ error: 'bad mode' });
  simModes.set(req.user.id, mode === 'recover' ? 'normal' : mode);
  res.json({ mode: simModes.get(req.user.id) });
});

router.get('/metrics', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query(
    'SELECT ts,uptime,latency_ms,status FROM metrics WHERE company_id=? ORDER BY id DESC LIMIT 100',
    [req.user.id]
  );
  res.json(rows.reverse());
});

router.get('/incidents', authMiddleware, async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM incidents WHERE company_id=? ORDER BY id DESC LIMIT 50', [
    req.user.id,
  ]);
  res.json(rows);
});

function startWorker(sec = Number(process.env.MONITOR_INTERVAL_SEC || 30)) {
  setInterval(tickAll, sec * 1000);
}

module.exports = { router, startWorker, tickAll };

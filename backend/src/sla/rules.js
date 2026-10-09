/**
 * ============================================================================
 * RECOUP AI SLA ENGINE — Vendor-Specific Rule Intelligence
 * ============================================================================
 *
 * SLA violation detection + credit calculation rules:
 *
 *   1. OUTAGE DETECTION   — uptime=0 → refundable violation (Cloudflare: 100% SLA)
 *   2. LATENCY ANALYSIS   — avg latency >200ms over 5 checks → violation (demo rule)
 *   3. CREDIT FORMULA     — proportional calculation with multiplier
 *   4. DEADLINE TRACKING  — 5-business-day claim window per Cloudflare SLA
 *
 * AI enhancement roadmap: fine-tune on public SLA documents to auto-learn
 * each vendor's formula (AWS: 99.95% → 10% credit, Twilio: 99.95% → 10%,
 * Zendesk: 99.9% → 10%, Salesforce: 99.9% → 5%...) without hardcoding rules.
 * ============================================================================
 */

function checkOutage({ outageMin, monthlyFee }) {
  const ratio = 1.0;
  const minutesPerMonth = 43200;
  return +(((outageMin * ratio) / minutesPerMonth) * Number(monthlyFee) * 10).toFixed(2);
}

function checkLatency(last5, monthlyFee) {
  if (!last5 || last5.length < 5) return { violated: false, credit: 0 };
  const avg = last5.reduce((a, b) => a + b, 0) / last5.length;
  if (avg > 200)
    return { violated: true, credit: +(Number(monthlyFee) * 0.15).toFixed(2), avg: Math.round(avg) };
  return { violated: false, credit: 0, avg: Math.round(avg) };
}

function claimDeadline(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

module.exports = { checkOutage, checkLatency, claimDeadline };

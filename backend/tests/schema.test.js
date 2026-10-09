const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');

test('all critical columns defined', () => {
  const cols = [
    'id INT AUTO_INCREMENT PRIMARY KEY',
    'company_id INT NOT NULL',
    'monthly_fee DECIMAL',
    'credit_usd DECIMAL',
    'password_hash VARCHAR',
    'claim_deadline DATE',
  ];
  for (const col of cols) assert.ok(sql.includes(col), `missing: ${col}`);
});

test('provider enum lists all 5 SaaS vendors', () => {
  assert.ok(sql.includes("ENUM('cloudflare','aws','twilio','zendesk','salesforce')"));
});

test('incident and metric enums match UI expectations', () => {
  assert.ok(sql.includes("ENUM('outage','latency')"));
  assert.ok(sql.includes("ENUM('open','claimed','recovered')"));
  assert.ok(sql.includes("ENUM('ok','outage','degraded')"));
  assert.ok(sql.includes("ENUM('company','vendor')"));
  assert.ok(sql.includes("ENUM('sent','failed')"));
});

test('foreign keys cascade on delete for every child table', () => {
  const cascades = (sql.match(/ON DELETE CASCADE/g) || []).length;
  assert.ok(cascades >= 4, `expected >=4 cascade FKs, got ${cascades}`);
});

test('metrics table indexed by (company_id, ts) for chart queries', () => {
  assert.ok(sql.includes('idx_metrics_company_ts'));
});
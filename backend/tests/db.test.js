const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('schema contains all 5 tables', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
  for (const t of ['companies', 'saas_integrations', 'metrics', 'incidents', 'notifications']) {
    assert.match(sql, new RegExp(t));
  }
});

const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'MyMan??024',
      database: process.env.DB_NAME || 'sla_monitor',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

async function initDb() {
  await getPool().query('SELECT 1');
}

module.exports = { getPool, initDb };

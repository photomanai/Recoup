#!/usr/bin/env bash
# Recoup backend installer — works on any Linux server.
# Usage:
#   DB_PASSWORD='secret' bash scripts/install-backend.sh
# What it does: checks tools -> npm install -> creates DB/tables ->
# creates backend/.env (if missing) -> runs backend tests.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/5] Checking tools (node 20+, npm, mariadb client)..."
command -v node >/dev/null || { echo "ERROR: node not found. Install Node.js 20+."; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm not found."; exit 1; }
if command -v mariadb >/dev/null; then DBCLI=mariadb;
elif command -v mysql >/dev/null; then DBCLI=mysql;
else echo "ERROR: neither 'mariadb' nor 'mysql' client found."; exit 1; fi
echo "    node $(node --version) | client: $DBCLI"

echo "==> [2/5] Installing backend dependencies..."
npm --prefix backend install --no-audit --no-fund

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-sla_monitor}"
if [ -z "${DB_PASSWORD:-}" ]; then
  read -rsp "MariaDB password for '$DB_USER'@$DB_HOST: " DB_PASSWORD; echo
fi

echo "==> [3/5] Creating database + tables ($DB_NAME)..."
export MYSQL_PWD="$DB_PASSWORD"
$DBCLI -h "$DB_HOST" -u "$DB_USER" < db/schema.sql
$DBCLI -h "$DB_HOST" -u "$DB_USER" -e "SHOW TABLES FROM $DB_NAME;"
unset MYSQL_PWD

echo "==> [4/5] backend/.env (create only if missing)..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  # prefill DB password so the server works right away
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" backend/.env
  echo "    created. IMPORTANT: set JWT_SECRET + ENCRYPTION_KEY inside backend/.env"
  echo "    generate key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
else
  echo "    exists, kept as-is."
fi

echo "==> [5/5] Running backend tests (starts temp API on :4000)..."
(node backend/src/index.js >/tmp/recoup-install-api.log 2>&1 & echo $! > /tmp/recoup-install-api.pid)
sleep 2
node --test backend/tests/*.test.js
kill "$(cat /tmp/recoup-install-api.pid)"

echo
echo "Backend READY. Run it:"
echo "  MONITOR_INTERVAL_SEC=10 MAIL_MODE=log node backend/src/index.js"
echo "  health: curl http://127.0.0.1:4000/api/health"

#!/usr/bin/env bash
# Recoup RESTART — stop + backend-i HOST:PORT-də arxa planda başlat + health check.
# Usage:
#   bash scripts/restart.sh                       # backend/.env-dəki HOST/PORT ilə
#   HOST=0.0.0.0 PORT=4000 bash scripts/restart.sh # env override
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/stop.sh

# HOST/PORT: env -> backend/.env -> default (0.0.0.0:4000)
APP_HOST="${HOST:-$(grep -E '^HOST=' backend/.env 2>/dev/null | cut -d= -f2 || true)}"
APP_HOST="${APP_HOST:-0.0.0.0}"
APP_PORT="${PORT:-$(grep -E '^PORT=' backend/.env 2>/dev/null | cut -d= -f2 || true)}"
APP_PORT="${APP_PORT:-4000}"
# 0.0.0.0-ə qulaq asanda health check 127.0.0.1-ə gedir
HEALTH_HOST="$APP_HOST"
[ "$HEALTH_HOST" = "0.0.0.0" ] && HEALTH_HOST="127.0.0.1"

echo "==> Backend başladılır ($APP_HOST:$APP_PORT)..."
HOST="$APP_HOST" PORT="$APP_PORT" nohup node backend/src/index.js >/tmp/recoup-api.log 2>&1 &
echo $! > /tmp/recoup-api.pid
sleep 2.5

if curl -sf "http://$HEALTH_HOST:$APP_PORT/api/health"; then
  echo
  echo "RESTART OK ($APP_HOST:$APP_PORT, pid $(cat /tmp/recoup-api.pid), log /tmp/recoup-api.log)"
else
  echo
  echo "ERROR: health check alınmadı, son log:"
  tail -20 /tmp/recoup-api.log || true
  exit 1
fi

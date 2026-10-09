#!/usr/bin/env bash
# Recoup frontend installer — works on any Linux server.
# Usage:
#   bash scripts/install-frontend.sh                 # local dev build
#   VITE_API_URL=https://api.example.com/api bash scripts/install-frontend.sh  # prod API
# What it does: npm install -> production build into frontend/dist.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/2] Installing frontend dependencies..."
npm --prefix frontend install --no-audit --no-fund

echo "==> [2/2] Building (VITE_API_URL=${VITE_API_URL:-http://localhost:4000/api})..."
if [ -n "${VITE_API_URL:-}" ]; then
  VITE_API_URL="$VITE_API_URL" npm --prefix frontend run build
else
  npm --prefix frontend run build
fi

echo
echo "Frontend READY: ./frontend/dist"
echo "  dev:     npm --prefix frontend run dev      # http://localhost:5173"
echo "  preview: npm --prefix frontend run preview # serves ./dist"
echo "  static:  npx --yes serve frontend/dist -l 5173"

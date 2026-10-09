#!/usr/bin/env bash
# Recoup STOP — işləyən backend + frontend dev proseslərini dayandırır.
# Usage:  bash scripts/stop.sh
set -uo pipefail
cd "$(dirname "$0")/.."

stopped=0

# Öz proses ağacımızı (özümüz + bütün valideyn shell-lər) qoru:
# pattern bəzən çağıran əmrin cmdline-ında da keçə bilər (məs: ... | grep "node backend/...").
excl=" $$"
_p=$PPID
while [ -n "${_p:-}" ] && [ "$_p" != "0" ] && [ "$_p" != "1" ]; do
  excl="$excl $_p"
  _p=$(ps -o ppid= -p "$_p" 2>/dev/null | tr -d '[:space:]')
  [ -z "${_p:-}" ] && break
done

in_excl() { # $1 = pid -> 0/1
  case "$excl" in *" $1"*) return 0;; esac
  return 1
}

kill_pat() { # $1 = pattern
  local pid
  for pid in $(pgrep -f "$1" 2>/dev/null || true); do
    in_excl "$pid" && continue
    kill "$pid" 2>/dev/null || true
    echo "dayandırıldı (pid $pid: $1)"
    stopped=1
  done
  sleep 1
  for pid in $(pgrep -f "$1" 2>/dev/null || true); do
    in_excl "$pid" && continue
    kill -9 "$pid" 2>/dev/null || true
  done
}

# 1) Məlum PID faylları (install/restart/verify-dən qalanlar)
for pidfile in /tmp/recoup-api.pid /tmp/recoup-install-api.pid /tmp/recoup-verify.pid; do
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && ! in_excl "$pid" && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      echo "dayandırıldı (pid $pid <- $pidfile)"
      stopped=1
    fi
    rm -f "$pidfile"
  fi
done

# 2) Pattern ilə tut (PID faylı olmasa belə)
kill_pat "node backend/src/index.js"
kill_pat "vite --port 5173"
kill_pat "vite --port=5173"

if [ "$stopped" -eq 0 ]; then
  echo "işləyən Recoup prosesi tapılmadı."
fi
echo "STOP DONE"

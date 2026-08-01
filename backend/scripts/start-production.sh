#!/usr/bin/env sh
# start-production.sh
#
# Single-host production entrypoint.
# Runs Prisma migrations first, then launches all three processes.
# Sends SIGTERM to all children on exit so they shut down gracefully.
#
# Usage:  sh scripts/start-production.sh
# Or via: npm run migrate:deploy && npm run start:all

set -e

echo "[startup] Running database migrations..."
node --experimental-specifier-resolution=node node_modules/.bin/prisma migrate deploy
echo "[startup] Migrations complete."

# Trap signals and forward to child process group
_term() {
  echo "[startup] Received shutdown signal. Stopping workers..."
  kill -TERM "$API_PID" "$WORKER_PID" "$WEBHOOK_PID" 2>/dev/null || true
  wait "$API_PID" "$WORKER_PID" "$WEBHOOK_PID" 2>/dev/null
  echo "[startup] All processes stopped."
  exit 0
}

trap _term TERM INT

echo "[startup] Starting API server..."
node --experimental-specifier-resolution=node dist/server.js &
API_PID=$!

echo "[startup] Starting message worker..."
node --experimental-specifier-resolution=node dist/workers/message.worker.js &
WORKER_PID=$!

echo "[startup] Starting webhook worker..."
node --experimental-specifier-resolution=node dist/workers/webhook.worker.js &
WEBHOOK_PID=$!

echo "[startup] All processes running. API=$API_PID, WORKER=$WORKER_PID, WEBHOOK=$WEBHOOK_PID"

# Wait for any child to exit
wait -n 2>/dev/null || wait
echo "[startup] A process exited unexpectedly. Shutting down."
_term

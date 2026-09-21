#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
for i in $(seq 1 10); do
  if alembic upgrade head; then
    echo "[entrypoint] Migrations applied."
    break
  fi
  echo "[entrypoint] Migration attempt $i failed, retrying in 3s..."
  sleep 3
done

if [ "$#" -gt 0 ]; then
  echo "[entrypoint] Starting: $@"
  exec "$@"
else
  echo "[entrypoint] Starting API server..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
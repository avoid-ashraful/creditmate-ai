#!/usr/bin/env bash
# One-command local stack: Postgres DB + Django backend + built React frontend.
# Usage: scripts/dev-up.sh [--celery] [--dev]
#   --celery  also start a Celery worker + beat (needs Redis)
#   --dev     serve the frontend with `npm start` (hot reload) instead of a production build
# Config via env (defaults in brackets): BE_DIR [./creditmate-ai-be] FE_DIR [./creditmate-ai-fe]
#   DB_NAME [creditmate_local] BE_PORT [8010] FE_PORT [3010] REDIS_DB [5] RUN_DIR [./.dev-run]
#   SEED [verified|smoke] (smoke = the 12 "Smoke Card" rows the e2e-live specs expect)
#   ADMIN_USER / ADMIN_EMAIL / ADMIN_PASSWORD  (all three set => create a staff superuser)
# Stop with scripts/dev-down.sh (same RUN_DIR).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BE_DIR=$(realpath "${BE_DIR:-./creditmate-ai-be}")
FE_DIR=$(realpath "${FE_DIR:-./creditmate-ai-fe}")
DB_NAME=${DB_NAME:-creditmate_local}
BE_PORT=${BE_PORT:-8010}
FE_PORT=${FE_PORT:-3010}
REDIS_DB=${REDIS_DB:-5}
SEED=${SEED:-verified}
RUN_DIR=$(realpath -m "${RUN_DIR:-./.dev-run}")
HOST=127.0.0.1
USE_CELERY=0; DEV_MODE=0
for arg in "$@"; do
  case $arg in
    --celery) USE_CELERY=1 ;;
    --dev) DEV_MODE=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# Heavy steps go through the box's CPU gate when it exists (no-op elsewhere).
gate() { if command -v heavy >/dev/null; then heavy "$@"; else "$@"; fi; }
port_free() { ! ss -ltn "sport = :$1" | grep -q LISTEN; }
wait_http() { # url, pid, log
  for _ in $(seq 1 120); do
    curl -fs -o /dev/null "$1" && return 0
    kill -0 "$2" 2>/dev/null || { echo "process died; see $3" >&2; tail -20 "$3" >&2; return 1; }
    sleep 1
  done
  echo "timeout waiting for $1; see $3" >&2; return 1
}

mkdir -p "$RUN_DIR"
[ -f "$RUN_DIR/backend.pid" ] && kill -0 "$(cat "$RUN_DIR/backend.pid")" 2>/dev/null \
  && { echo "stack already running in $RUN_DIR (run scripts/dev-down.sh first)" >&2; exit 1; }
for p in "$BE_PORT" "$FE_PORT"; do port_free "$p" || { echo "port $p is in use" >&2; exit 1; }; done

echo "==> database $DB_NAME"
psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || createdb "$DB_NAME"

echo "==> backend venv"
cd "$BE_DIR"
[ -d .venv ] || uv venv --python 3.12 .venv
gate uv sync --dev --quiet

# Backend env lives in RUN_DIR; real env vars win over any BE_DIR/.env, which is never touched.
# Throttles are relaxed so click-through QA and the e2e suite don't hit 429s.
cat > "$RUN_DIR/backend.env" <<ENV
DEBUG=True
SECRET_KEY=local-dev-only-$DB_NAME
ENVIRONMENT=local
SEARCH_ENABLED=False
DATABASE_URL=postgresql:///$DB_NAME
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://$HOST:$FE_PORT
CORS_ALLOWED_ORIGINS=http://$HOST:$FE_PORT,http://localhost:$FE_PORT
CSRF_TRUSTED_ORIGINS=http://$HOST:$FE_PORT,http://localhost:$FE_PORT
ALLOWED_HOSTS=$HOST,localhost,testserver
REDIS_CACHE_URL=redis://127.0.0.1:6379/$REDIS_DB
CELERY_BROKER_URL=redis://127.0.0.1:6379/$REDIS_DB
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/$REDIS_DB
THROTTLE_RATE_ANON=1000/min
THROTTLE_RATE_USER=1000/min
THROTTLE_RATE_BURST=100/sec
THROTTLE_RATE_REVIEW_WRITE=100/hour
THROTTLE_RATE_AUTH_BURST=100/min
THROTTLE_RATE_AUTH_ANON=100/min
THROTTLE_RATE_AUTH_USER=1000/min
ENV
set -a; . "$RUN_DIR/backend.env"; set +a
PY=$BE_DIR/.venv/bin/python

echo "==> migrate + load data ($SEED)"
"$PY" manage.py migrate --noinput -v 0
if [ "$SEED" = smoke ]; then
  # seed_smoke_data creates rows unconditionally, so only run it on an empty table.
  "$PY" manage.py shell -c "import sys; from credit_cards.models import CreditCard as C; sys.exit(C.objects.exists())" \
    && "$PY" scripts/seed_smoke_data.py
else
  "$PY" manage.py loaddata all_banks.json
  "$PY" manage.py import_cards credit_cards/fixtures/verified_cards_2026-10-18.json
fi

if [ -n "${ADMIN_USER:-}" ] && [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "==> staff superuser $ADMIN_USER"
  DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD "$PY" manage.py createsuperuser --noinput \
    --username "$ADMIN_USER" --email "$ADMIN_EMAIL" 2>&1 | grep -v "already taken" || true
fi

echo "==> backend on http://$HOST:$BE_PORT"
nohup "$PY" manage.py runserver "$HOST:$BE_PORT" --noreload > "$RUN_DIR/backend.log" 2>&1 &
echo $! > "$RUN_DIR/backend.pid"
wait_http "http://$HOST:$BE_PORT/api/v1/credit-cards/?page_size=1" "$(cat "$RUN_DIR/backend.pid")" "$RUN_DIR/backend.log"

if [ "$USE_CELERY" = 1 ]; then
  echo "==> celery worker + beat"
  nohup "$BE_DIR/.venv/bin/celery" -A credit_mate_ai worker -l info > "$RUN_DIR/celery-worker.log" 2>&1 &
  echo $! > "$RUN_DIR/celery-worker.pid"
  nohup "$BE_DIR/.venv/bin/celery" -A credit_mate_ai beat -l info \
    -s "$RUN_DIR/celerybeat-schedule" > "$RUN_DIR/celery-beat.log" 2>&1 &
  echo $! > "$RUN_DIR/celery-beat.pid"
fi

echo "==> frontend on http://$HOST:$FE_PORT"
cd "$FE_DIR"
export REACT_APP_API_BASE_URL="http://$HOST:$BE_PORT/api/v1"
export REACT_APP_SITE_URL="http://$HOST:$FE_PORT"
if [ "$DEV_MODE" = 1 ]; then
  # npm start spawns children, so dev-down stops the whole process group (setsid).
  BROWSER=none PORT=$FE_PORT HOST=$HOST setsid nohup npm start > "$RUN_DIR/frontend.log" 2>&1 &
else
  # Per-stack output dir so two stacks (e.g. the e2e one) never share a bundle with a different API URL.
  export BUILD_PATH=$RUN_DIR/fe-build
  gate npm run build > "$RUN_DIR/frontend-build.log" 2>&1 \
    || { tail -30 "$RUN_DIR/frontend-build.log" >&2; exit 1; }
  setsid nohup npx --no-install serve -s "$BUILD_PATH" -l "tcp://$HOST:$FE_PORT" > "$RUN_DIR/frontend.log" 2>&1 &
fi
echo $! > "$RUN_DIR/frontend.pid"
wait_http "http://$HOST:$FE_PORT/" "$(cat "$RUN_DIR/frontend.pid")" "$RUN_DIR/frontend.log"

cat <<MSG

CreditMate is up:
  frontend  http://$HOST:$FE_PORT
  API       http://$HOST:$BE_PORT/api/v1/   (admin: http://$HOST:$BE_PORT/admin/)
  logs      $RUN_DIR/*.log   (verification emails print to backend.log)
  stop      RUN_DIR=$RUN_DIR $SCRIPT_DIR/dev-down.sh
MSG

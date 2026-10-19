#!/usr/bin/env bash
# Stop exactly the processes scripts/dev-up.sh started (PIDs in RUN_DIR); never matches by name.
set -euo pipefail
RUN_DIR=$(realpath -m "${RUN_DIR:-./.dev-run}")
for name in frontend celery-beat celery-worker backend; do
  f="$RUN_DIR/$name.pid"
  [ -f "$f" ] || continue
  pid=$(cat "$f")
  if kill -0 "$pid" 2>/dev/null; then
    # frontend was started with setsid, so its pid is also its process-group id.
    if [ "$name" = frontend ]; then kill -- "-$pid" 2>/dev/null || kill "$pid"; else kill "$pid"; fi
    for _ in $(seq 1 50); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
    echo "stopped $name ($pid)"
  fi
  rm -f "$f"
done

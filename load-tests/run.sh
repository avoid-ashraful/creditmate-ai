#!/usr/bin/env bash
# Runner for the k6 load-test suite. No make, no npm.
#
# Usage:
#   ./run.sh inspect                          k6 inspect every script (structure, options, thresholds)
#   ./run.sh stub [scenario]                  start the local stub on a free port in 4000-4999,
#                                             run the scenario against it (default: smoke), then stop the stub
#   ./run.sh run <scenario> <BASE_URL>        run a scenario against a URL you name explicitly
#
# Scenarios: smoke | average | stress | spike
#
# Environment:
#   K6            k6 binary (default: k6 on PATH)
#   RESULTS_DIR   where <scenario>-results.json is written (default: load-tests/results)
#   HEALTH_PATH   health route relative to BASE_URL (default: /health/)
#
# Only the stub and BASE_URLs you pass explicitly are targeted. Nothing here
# contacts a remote host unless you give it one.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6="${K6:-k6}"
RESULTS_DIR="${RESULTS_DIR:-$SCRIPT_DIR/results}"
SCENARIOS=(smoke average stress spike)

die() { echo "run.sh: $*" >&2; exit 2; }

script_for() {
  case "$1" in
    smoke) echo "$SCRIPT_DIR/smoke.js" ;;
    average) echo "$SCRIPT_DIR/average-load.js" ;;
    stress) echo "$SCRIPT_DIR/stress.js" ;;
    spike) echo "$SCRIPT_DIR/spike.js" ;;
    *) die "unknown scenario '$1' (expected: ${SCENARIOS[*]})" ;;
  esac
}

require_k6() {
  command -v "$K6" >/dev/null 2>&1 || die "k6 not found (set K6=/path/to/k6 or put it on PATH)"
}

cmd_inspect() {
  require_k6
  for name in "${SCENARIOS[@]}"; do
    echo "== k6 inspect $(basename "$(script_for "$name")")"
    "$K6" inspect "$(script_for "$name")" >/dev/null
  done
  echo "all scripts inspected OK"
}

# Run k6 from the results directory so the summary files land there, not in the repo.
run_k6() {
  local scenario="$1" base_url="$2"
  require_k6
  mkdir -p "$RESULTS_DIR"
  (
    cd "$RESULTS_DIR"
    "$K6" run -e "BASE_URL=$base_url" ${HEALTH_PATH:+-e "HEALTH_PATH=$HEALTH_PATH"} "$(script_for "$scenario")"
  )
}

# Pick a free TCP port in 4000-4999 on loopback.
pick_port() {
  python3 - <<'EOF'
import random, socket
for _ in range(500):
    port = random.randint(4000, 4999)
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        raise SystemExit(0)
raise SystemExit("no free port in 4000-4999")
EOF
}

# PID of the stub started by this invocation; only this process is ever stopped.
STUB_PID=""

stop_stub() {
  if [[ -n "$STUB_PID" ]] && kill -0 "$STUB_PID" 2>/dev/null; then
    kill "$STUB_PID" 2>/dev/null || true
    wait "$STUB_PID" 2>/dev/null || true
  fi
}
trap stop_stub EXIT

cmd_stub() {
  local scenario="${1:-smoke}"
  script_for "$scenario" >/dev/null
  local port
  port="$(pick_port)"

  mkdir -p "$RESULTS_DIR"
  python3 "$SCRIPT_DIR/stub/server.py" --port "$port" >"$RESULTS_DIR/stub.log" 2>&1 &
  STUB_PID=$!

  local ready=0
  for _ in $(seq 1 50); do
    if python3 -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:$port/health/', timeout=1)" 2>/dev/null; then
      ready=1
      break
    fi
    kill -0 "$STUB_PID" 2>/dev/null || die "stub exited early; see $RESULTS_DIR/stub.log"
    python3 -c "import time; time.sleep(0.1)"
  done
  [[ "$ready" == 1 ]] || die "stub did not become ready on port $port"

  echo "stub pid=$STUB_PID port=$port"
  run_k6 "$scenario" "http://127.0.0.1:$port"
}

cmd_run() {
  [[ $# -eq 2 ]] || die "usage: ./run.sh run <scenario> <BASE_URL>"
  script_for "$1" >/dev/null
  run_k6 "$1" "$2"
}

case "${1:-}" in
  inspect) cmd_inspect ;;
  stub) shift; cmd_stub "$@" ;;
  run) shift; cmd_run "$@" ;;
  ""|-h|--help|help)
    sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    ;;
  *) die "unknown command '$1' (try: inspect | stub | run)" ;;
esac

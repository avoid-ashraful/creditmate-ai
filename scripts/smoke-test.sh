#!/usr/bin/env bash
# Post-deploy smoke test. Read-only: issues GET requests only, never writes data.
#
# Usage: scripts/smoke-test.sh https://staging.creditmate.ai
# Env:   SMOKE_TIMEOUT  per-request timeout in seconds (default 10)
#
# Exits 0 when every check passes, 1 when any check fails, 2 on bad usage.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <base-url>" >&2
  exit 2
fi

base="${1%/}"
timeout_s="${SMOKE_TIMEOUT:-10}"
failures=0

check() {
  local label="$1" path="$2" expected="$3" code
  # curl already prints 000 when it cannot connect; the fallback only replaces the exit status.
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$timeout_s" "${base}${path}")" || code="000"
  if [[ "$code" == "$expected" ]]; then
    echo "PASS ${label} ${path} -> ${code}"
  else
    echo "FAIL ${label} ${path} -> ${code} (expected ${expected})"
    failures=$((failures + 1))
  fi
}

check frontend-health /healthz 200
check frontend-index / 200
check backend-liveness /api/healthz/ 200
check backend-readiness /api/readyz/ 200

if [[ "$failures" -gt 0 ]]; then
  echo "smoke test FAILED: ${failures} check(s) failed against ${base}" >&2
  exit 1
fi
echo "smoke test passed against ${base}"

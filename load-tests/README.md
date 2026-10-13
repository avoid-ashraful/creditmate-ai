# CreditMate AI - k6 Load Testing Suite

This directory contains k6 load test scripts for the CreditMate AI public API endpoints.

## Quick Start

```bash
# Install k6 (if not installed)
# macOS: brew install k6
# Linux: sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install k6
# Windows: choco install k6

# Run smoke test (quick validation)
k6 run -e BASE_URL=http://localhost:8000 smoke.js

# Run average load test (5-10 min)
k6 run -e BASE_URL=http://localhost:8000 average-load.js

# Run stress test (find breaking point)
k6 run -e BASE_URL=http://localhost:8000 stress.js

# Run spike test (sudden burst)
k6 run -e BASE_URL=http://localhost:8000 spike.js
```

## Scripts Overview

| Script | Purpose | Duration | VUs | Use Case |
|--------|---------|----------|-----|----------|
| `smoke.js` | Basic functionality check | 30s | 1 | CI/CD, pre-deploy |
| `average-load.js` | Realistic sustained traffic | ~16 min | 50-100 | Baseline, regression |
| `stress.js` | Beyond capacity limits | ~18 min | 100-500 | Capacity planning |
| `spike.js` | Sudden traffic burst | ~5 min | 50-500 | Auto-scaling, recovery |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:8000` | API base URL (no trailing slash) |

```bash
# Override base URL
k6 run -e BASE_URL=https://staging.creditmate.ai smoke.js

# Multiple variables
k6 run -e BASE_URL=http://api:8000 -e SCENARIO=smoke smoke.js
```

### Thresholds (Shared)

All scenarios enforce these core thresholds (from Task 5.6 acceptance criteria):

- **p95 latency** < 200ms (smoke/average) / < 500ms (stress/spike)
- **p99 latency** < 500ms (smoke/average) / < 1000ms (stress/spike)
- **Error rate** < 1% (smoke/average) / < 5% (stress/spike)
- **Check pass rate** > 99% (smoke/average) / > 95% (stress/spike)

### Rate Limit Handling (429 Responses)

The backend enforces these limits (from `credit_mate_ai/settings.py`):

```
Anonymous:  100 requests/minute  (THROTTLE_RATE_ANON)
Authenticated: 1000 requests/minute (THROTTLE_RATE_USER)
Burst:      10 requests/second   (THROTTLE_RATE_BURST)
```

**How k6 handles 429s:**

1. **429s are NOT counted as errors** - They're tracked via custom metrics:
   - `rate_limited_429_total` - Counter of 429 responses
   - `rate_limited_429_rate` - Rate of 429 responses

2. **Retry-After header** is read and logged (but k6 doesn't auto-retry)

3. **Thresholds exclude 429** - The `http_req_failed` metric only counts 5xx and network errors

4. **Expected behavior per scenario:**
   - **Smoke**: 1 VU, 30s → Should see 0-5 429s (well within 100/min)
   - **Average**: 50-100 VUs sustained → Will hit anon limits, expect 429s
   - **Stress**: 100-500 VUs → Heavy 429s expected, tests throttling behavior
   - **Spike**: 500 VUs burst → Massive 429s, tests burst protection (10/sec)

## Output Formats

### JSON (Default)
```bash
k6 run --out json=results.json smoke.js
```
Produces `results.json` with full metrics for post-processing.

### Prometheus Remote Write (Grafana)
Requires k6 built with `xk6-output-prometheus-remote`:
```bash
# Build custom k6
xk6 build --with github.com/grafana/xk6-output-prometheus-remote

# Run with Prometheus remote write
./k6 run --out experimental-prometheus-rw=http://prometheus:9090/api/v1/write smoke.js
```

### Summary Report (stdout)
Each script outputs a structured JSON summary to stdout and a `.json` file:
- `smoke-results.json`
- `average-load-results.json`
- `stress-results.json`
- `spike-results.json`

## Results Interpretation Guide

### Key Metrics to Watch

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `http_req_duration p(95)` | < 200ms | 200-500ms | > 500ms |
| `http_req_duration p(99)` | < 500ms | 500-1000ms | > 1000ms |
| `http_req_failed rate` | < 0.1% | 0.1-1% | > 1% |
| `rate_limited_429_rate` | < 5% (avg) | 5-20% | > 20% (unexpected) |
| `checks pass rate` | > 99% | 95-99% | < 95% |

### Analyzing 429 Rate Limiting

**Expected 429 rates by scenario:**

| Scenario | VUs | Expected 429 Rate | Reason |
|----------|-----|-------------------|--------|
| Smoke | 1 | ~0% | Well below 100/min |
| Average | 50-100 | 10-30% | Exceeds anon 100/min |
| Stress | 100-500 | 30-70% | Far exceeds limits |
| Spike | 500 | 60-90% | Burst exceeds 10/sec |

**If 429 rate is LOWER than expected:**
- Rate limiting may not be enforced (check middleware)
- Requests may be authenticated (higher 1000/min limit)

**If 429 rate is HIGHER than expected:**
- Burst limit (10/sec) may be stricter than configured
- Check `Retry-After` header values in responses

### Bottleneck Identification

**High latency + low 429 + low error rate:**
- Database query optimization needed
- Missing indexes on filter fields
- Cache miss rate high (check Redis hit rate)

**High latency + high 429:**
- Throttling working correctly
- Consider increasing limits or adding caching

**High error rate (5xx):**
- Application crashes under load
- Connection pool exhaustion
- Memory/CPU saturation

**Spike test recovery latency >> normal latency:**
- Slow scale-down / connection drain
- Cache cold after spike
- Database connection pool not recovering

### Grafana Dashboard Queries

```promql
# p95 latency per endpoint
histogram_quantile(0.95, rate(http_req_duration_bucket{type="api"}[5m]))

# 429 rate
rate(rate_limited_429_total[5m])

# Error rate (excluding 429)
rate(http_req_failed[5m])

# Throughput
rate(http_reqs[5m])

# Active VUs
active_vus
```

## Local Validation (No Backend Required)

### Syntax Check (Node.js)
```bash
# Check all scripts for syntax errors
node --check config.js
node --check smoke.js
node --check average-load.js
node --check stress.js
node --check spike.js

# Or all at once
for f in *.js; do echo "Checking $f..."; node --check "$f"; done
```

### Run Against HTTP Stub (Python)
```bash
# Terminal 1: Start stub server (serves mock responses)
cd load-tests
python3 -m http.server 8000 --bind 127.0.0.1 -d stub/

# Terminal 2: Run smoke test
k6 run -e BASE_URL=http://localhost:8000 smoke.js
```

Create `load-tests/stub/` with mock JSON responses matching API schema:
```
stub/
├── api/
│   └── v1/
│       ├── health/
│       │   └── index.json          # {"status": "ok"}
│       ├── credit-cards/
│       │   ├── index.json          # Paginated list response
│       │   └── advanced-search/
│       │       └── index.json      # Search results
│       └── search-suggestions/
│           └── index.json          # Typeahead suggestions
```

### k6 Inspect (Validate Script Structure)
```bash
# Show script configuration without running
k6 inspect smoke.js

# Show thresholds
k6 inspect --format=json smoke.js | jq '.thresholds'
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Smoke Tests
  run: |
    k6 run -e BASE_URL=${{ env.API_URL }} load-tests/smoke.js
    
- name: Run Load Tests (on schedule)
  if: github.event_name == 'schedule'
  run: |
    k6 run -e BASE_URL=${{ env.STAGING_URL }} \
      --out json=results.json \
      load-tests/average-load.js
      
- name: Upload Results
  uses: actions/upload-artifact@v4
  with:
    name: k6-results
    path: *-results.json
```

## Troubleshooting

### "Connection refused" / "No route to host"
- Verify `BASE_URL` is correct and server is running
- Check firewall / network policies

### "Script validation failed" / Syntax errors
- Run `node --check script.js` to find JS syntax issues
- k6 uses ES6 modules - ensure `import`/`export` syntax

### High memory usage
- Use `discardResponseBodies: true` (already set)
- Reduce VU count or duration
- Use `--no-summary` to reduce output buffer

### Thresholds failing unexpectedly
- Check if backend is actually running at `BASE_URL`
- Verify rate limits match expectations (check `settings.py`)
- Ensure test data (card IDs) exists in test database

## File Structure

```
load-tests/
├── config.js           # Shared configuration, thresholds, helpers
├── smoke.js            # Smoke test (30s, 1 VU)
├── average-load.js     # Average load (~16 min, 50-100 VUs)
├── stress.js           # Stress test (~18 min, 100-500 VUs)
├── spike.js            # Spike test (~5 min, 50-500 VUs)
├── README.md           # This file
└── stub/               # (Optional) Mock responses for local validation
    └── api/v1/...
```

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [Output Formats](https://k6.io/docs/results-visualization/)
- Backend rate limits: `/home/ubuntu/credit-workers/integration/creditmate-ai-be/credit_mate_ai/settings.py` lines 309-316
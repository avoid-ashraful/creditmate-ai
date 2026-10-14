# CreditMate AI - k6 Load Testing Suite

k6 scenarios for the public, read-only credit-card API. Every request is a `GET` against a route the
backend serves today. Endpoint names and query parameters are taken from the backend source
(`credit_mate_ai/urls.py`, `credit_cards/api/urls.py`, `filters.py`, `advanced_filters.py`,
`advanced_views.py`) and throttle values from `credit_mate_ai/settings.py`.

## Quick start

```bash
# k6 binary: put it on PATH, or point K6 at it
./run.sh inspect                                  # k6 inspect on every script
./run.sh stub smoke                               # local stub on a random port 4000-4999, then smoke
./run.sh run smoke http://localhost:8000          # against a URL you name explicitly
./run.sh run average http://localhost:8000        # ~16 min; see scenario table
```

No `make` or `npm` is needed. `run.sh` only contacts the stub it starts or a `BASE_URL` you pass on the
command line.

### Installing k6

Official releases: https://github.com/grafana/k6/releases. Verify the tarball against the release's
`k6-vX.Y.Z-checksums.txt` before use (`sha256sum -c`). Without root, extract the binary into
`~/.local/bin`. On macOS, `brew install k6`. On Debian/Ubuntu with root, use the k6 apt repository.

Validated with k6 v2.3.0 (linux/arm64).

## Scenarios

| Script | Purpose | Duration | Load shape |
|--------|---------|----------|------------|
| `smoke.js` | Every endpoint once per iteration | 30s | 1 VU constant |
| `average-load.js` | Weighted user mix, sustained traffic | ~16 min | ramp to 50 then 100 VUs |
| `stress.js` | Find where latency and errors break | ~18 min | ramp to 500 VUs |
| `spike.js` | Burst, then recovery | ~5 min | 50 → 500 → 50 VUs |

`average-load.js` mix: list 40%, detail 25%, typeahead 20%, advanced search 10%, health 5%.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `BASE_URL` | `http://localhost:8000` | Origin only, no trailing slash |
| `HEALTH_PATH` | `/health/` | Health route, relative to `BASE_URL` and **not** under `/api/v1` |
| `RESULTS_DIR` (run.sh) | `load-tests/results` | Where `<scenario>-results.json` and the stub log go |
| `K6` (run.sh) | `k6` | k6 binary to use |

`HEALTH_PATH` exists because `/api/healthz/` and `/api/readyz/` are planned but not yet routed. Set
`HEALTH_PATH=/api/healthz/` once they land.

## Endpoints exercised

All paths are relative to `BASE_URL`. Only `GET` is used.

| Method | Path | Parameters used by the suite | Notes |
|--------|------|------------------------------|-------|
| GET | `/health/` | none | Root route, `credit_mate_ai/urls.py`. Override with `HEALTH_PATH`. |
| GET | `/api/v1/credit-cards/` | `bank_name`, `annual_fee_min`, `annual_fee_max`, `has_lounge_access`, `no_annual_fee`, `search`, `ordering` | Paginated `{count, next, previous, results}`. `ordering` accepts `name`, `annual_fee`, `interest_rate_apr`, `lounge_access_international`, `lounge_access_domestic`, `created_at`, `updated_at`, each with optional `-`. |
| GET | `/api/v1/credit-cards/{id}/` | none | Card IDs come from the list in `setup()`. Setup fails the run if the list is empty. |
| GET | `/api/v1/credit-cards/search-suggestions/` | `q` (sent by smoke only) | **The backend view does not read `q`.** The parameter is sent to match the documented route but has no effect today. |
| GET | `/api/v1/credit-cards/typeahead/` | `q` | `q` needs at least 2 characters. Shorter input returns 200 with `match_policy.active = false`. Only the first 100 characters are used. |
| GET | `/api/v1/credit-cards/advanced-search/` | `search`, `categories` (comma-separated slugs), `bank_name`, `annual_fee_min/max`, `has_lounge_access`, `has_international_lounge`, `has_domestic_lounge`, `has_annual_fee`, `no_annual_fee`, `has_fee_waiver`, `interest_rate_min/max`, `ordering`, `page`, `page_size`, `facets` | Returns `results`, `facets`, `normalized_query`, plus `sort_options` and `categories`. `ordering` accepts `name`, `annual_fee`, `interest_rate_apr`, lounge fields, `created`, `modified`, each with optional `-`. |
| GET | `/api/v1/credit-cards/advanced-search/sort-options/` | none | Returns `sort_options`. |
| GET | `/api/v1/credit-cards/advanced-search/categories/` | none | Returns `categories` (canonical taxonomy). |
| GET | `/api/v1/credit-cards/advanced-search/normalize/` | same as advanced-search | Returns `normalized_query` and `query_hash`. |

Unknown query parameters are silently ignored by the backend. Earlier drafts sent `category`, `sort`, and
`bank`, which have no effect. The suite now uses only the names listed above.

## Thresholds

Each metric appears once per scenario, so the p95 and p99 limits are both enforced.

| Scenario | `http_req_duration{type:api}` | `http_req_failed` | `checks` |
|----------|-------------------------------|-------------------|----------|
| smoke, average | `p(95)<200`, `p(99)<500` | `rate<0.01` | `rate>0.99` |
| stress, spike | `p(95)<500`, `p(99)<1000` | `rate<0.05` | `rate>0.95` |

`http_req_failed` counts only responses outside 200–399 **other than 429** (see below), plus network
errors. A 404 or 5xx counts as a failure.

Per-request latency checks inside the scripts (for example `list: < 200ms`) are separate from these
thresholds. They feed the `checks` rate.

## Rate limiting (429)

From `credit_mate_ai/settings.py` (`DEFAULT_THROTTLE_RATES`, each overridable by env var):

| Scope | Default | Env var | Keyed by |
|-------|---------|---------|----------|
| anon | 100/min | `THROTTLE_RATE_ANON` | `REMOTE_ADDR` (unauthenticated) |
| user | 1000/min | `THROTTLE_RATE_USER` | user id, or `REMOTE_ADDR` when anonymous |
| burst | 10/sec | `THROTTLE_RATE_BURST` | user id, or `REMOTE_ADDR` when anonymous |

`TrustedClientRateThrottle` (`credit_mate_ai/throttling.py`) checks burst, then user, then anon. For
anonymous traffic the anon limit (100/min per IP) is the stricter one and is the effective ceiling. The
suite sends no credentials, so every virtual user from one machine shares one IP bucket. Expect 429s
from the average, stress, and spike scenarios when run from a single host.

How the suite handles 429:

- 429 is an accepted response for the status checks. It is not a failure, so it does not trip
  `http_req_failed`.
- It is counted in `rate_limited_429_total` (count) and `rate_limited_429_rate` (rate).
- Latency is recorded only for non-429 responses, so throttling does not distort the latency numbers.
- k6 does not retry, and `Retry-After` is not read.

To measure backend latency without the throttle, run from several source IPs, or raise
`THROTTLE_RATE_*` on a dedicated test environment. Do not change production limits for this.

## Output

Each scenario writes `<scenario>-results.json` to the current directory (`RESULTS_DIR` under `run.sh`)
and prints the same JSON to stdout. Fields:

- `allThresholdsPassed` and `thresholds[]` (each threshold with `ok`)
- `configuredThresholds` (what the script asked for)
- `metrics` for `http_req*`, `checks`, `api_latency`, `rate_limited_*`, and `recovery_latency` (spike)

Requests are tagged `type=api` and `endpoint=<name>`, and overload runs also carry `phase=<name>`. Use
those tags to break results down in Prometheus or k6 Cloud.

```promql
# p95 latency, all API requests
histogram_quantile(0.95, rate(http_req_duration_bucket{type="api"}[5m]))

# 429 rate
rate(rate_limited_429_total[5m])

# Error rate (429 excluded)
rate(http_req_failed[5m])
```

## Local validation with the stub

`stub/server.py` is a `ThreadingHTTPServer` that serves the same paths and response shapes as the
backend (`/health/`, `/api/v1/credit-cards/...`). It has 25 fixture cards, and detail IDs 1–25 exist.

It does **not** filter, rank, paginate beyond a fixed slice, or throttle. Use it to check routing,
parameter handling, and script logic. It cannot show backend performance or the 429 path.

```bash
./run.sh stub smoke     # random port 4000-4999; stub stopped on exit
```

Negative control: with `HEALTH_PATH=/api/healthz/` (not served by the stub), smoke fails on the health
404s and exits 99.

## Validation without a backend

```bash
./run.sh inspect        # k6 inspect for all four scripts (parses and reports options and thresholds)
k6 inspect smoke.js | python3 -c 'import json,sys; print(json.load(sys.stdin)["thresholds"])'
```

`node --check <script>` only parses the file. It passes on these scripts but does not catch unknown k6 APIs, bad thresholds, or wrong options. Use `k6 inspect` for that.

## Troubleshooting

- **All requests fail with connection errors**: check `BASE_URL` and that the server is up. For the stub,
  check `RESULTS_DIR/stub.log`.
- **`setup: list returned no cards`**: the list endpoint returned zero results. Check the target has
  active cards (`is_active=True`).
- **Smoke fails on health with 404**: `HEALTH_PATH` points at a route the target does not serve.
- **Many 429s**: expected from one IP at this request rate. See "Rate limiting".
- **`http_req_failed` above threshold**: look for 5xx or 404 responses. A 404 on detail means the card ID
  from the list is no longer served.

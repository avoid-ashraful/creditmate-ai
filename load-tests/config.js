/**
 * Shared k6 Configuration
 * 
 * All scenarios import this module for common settings:
 * - BASE_URL (defaults to http://localhost:8000)
 * - Thresholds (p95 latency, error rate < 1%)
 * - Rate limit handling (429 as distinct counter)
 * - Common headers and helper functions
 */

// Base URL for the API - override with: k6 run -e BASE_URL=http://your-api:8000 script.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// API version prefix
export const API_PREFIX = '/api/v1';

// Common headers for all requests
export const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'k6-load-test/1.0',
};

// Thresholds - shared across all scenarios
export const THRESHOLDS = {
  // p95 latency should be under 200ms (per Task 5.6 acceptance criteria)
  'http_req_duration{type:api}': ['p(95)<200'],
  // p99 latency should be under 500ms
  'http_req_duration{type:api}': ['p(99)<500'],
  // Overall error rate < 1%
  'http_req_failed': ['rate<0.01'],
  // 429 (rate limited) should be tracked separately, not counted as errors
  // We'll track this via a custom metric
};

// Custom thresholds per scenario (can be extended in each scenario)
export const SCENARIO_THRESHOLDS = {
  smoke: {
    'http_req_duration{type:api}': ['p(95)<200', 'p(99)<500'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
  average: {
    'http_req_duration{type:api}': ['p(95)<200', 'p(99)<500'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
  stress: {
    'http_req_duration{type:api}': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],
    'checks': ['rate>0.95'],
  },
  spike: {
    'http_req_duration{type:api}': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],
    'checks': ['rate>0.95'],
  },
};

// Rate limit configuration from backend settings (credit_mate_ai/settings.py)
// Anonymous: 100 req/min, Authenticated: 1000 req/min, Burst: 10/sec
export const RATE_LIMITS = {
  anon: { rpm: 100, rps: 10 },      // 100/min, burst 10/sec
  user: { rpm: 1000, rps: 10 },     // 1000/min, burst 10/sec
  burst: { rps: 10 },               // 10/sec burst protection
};

// Custom metric names for 429 tracking
export const METRIC_NAMES = {
  rateLimited: 'rate_limited_429_total',
  rateLimitedRate: 'rate_limited_429_rate',
};

// Helper to build full API URLs
export function url(path) {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

// Helper to check if response is rate limited (429)
export function isRateLimited(response) {
  return response.status === 429;
}

// Helper to extract Retry-After header (seconds)
export function getRetryAfter(response) {
  const retryAfter = response.headers['Retry-After'] || response.headers['retry-after'];
  return retryAfter ? parseInt(retryAfter, 10) : 1;
}

// Common check functions
export const checks = {
  status200: (r) => r.status === 200,
  status2xx: (r) => r.status >= 200 && r.status < 300,
  status429: (r) => r.status === 429,
  hasBody: (r) => r.body && r.body.length > 0,
  isJson: (r) => {
    const ct = r.headers['Content-Type'] || r.headers['content-type'];
    return ct && ct.includes('application/json');
  },
  latencyUnder: (ms) => (r) => r.timings.duration < ms,
};

// Scenario executor options presets
export const EXECUTOR_PRESETS = {
  // Constant VUs for smoke test
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  // Ramping up for average load
  average: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 50 },   // Ramp up to 50 VUs
      { duration: '5m', target: 50 },   // Sustain 50 VUs
      { duration: '2m', target: 100 },  // Ramp to 100 VUs
      { duration: '5m', target: 100 },  // Sustain 100 VUs
      { duration: '2m', target: 0 },    // Ramp down
    ],
  },
  // Stress test - push beyond normal capacity
  stress: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 100 },   // Ramp up
      { duration: '5m', target: 100 },   // Baseline
      { duration: '3m', target: 200 },   // Stress
      { duration: '3m', target: 300 },   // Heavy stress
      { duration: '3m', target: 500 },   // Breaking point
      { duration: '2m', target: 0 },     // Ramp down
    ],
  },
  // Spike test - sudden traffic burst
  spike: {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 50 },    // Normal load
      { duration: '30s', target: 500 },  // Sudden spike
      { duration: '1m', target: 500 },   // Sustain spike
      { duration: '30s', target: 50 },   // Drop back
      { duration: '1m', target: 50 },    // Recovery
      { duration: '1m', target: 0 },     // Ramp down
    ],
  },
};

// Output options for Grafana/Prometheus
export const OUTPUT_OPTIONS = {
  // JSON output for post-processing
  json: {
    output: 'json',
  },
  // Prometheus remote write (requires k6 with xk6-output-prometheus-remote)
  // Enable with: k6 run --out experimental-prometheus-rw=... script.js
  prometheusRemoteWrite: {
    output: 'experimental-prometheus-rw',
  },
};

export default {
  BASE_URL,
  API_PREFIX,
  DEFAULT_HEADERS,
  THRESHOLDS,
  SCENARIO_THRESHOLDS,
  RATE_LIMITS,
  METRIC_NAMES,
  url,
  isRateLimited,
  getRetryAfter,
  checks,
  EXECUTOR_PRESETS,
  OUTPUT_OPTIONS,
};
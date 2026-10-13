/**
 * Shared k6 configuration for the CreditMate AI load-test suite.
 *
 * Every endpoint path below mirrors the real backend routing:
 *   - credit_mate_ai/urls.py        -> /health/ (root, legacy health check)
 *   - credit_cards/api/urls.py      -> /api/v1/credit-cards/...
 *   - credit_cards/api/filters.py   -> list filter names
 *   - credit_cards/api/advanced_filters.py -> advanced-search filter names
 *   - credit_mate_ai/settings.py    -> throttle rates
 */

import http from 'k6/http';

// Base URL, no trailing slash. Override: k6 run -e BASE_URL=http://127.0.0.1:4123 smoke.js
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

// Health endpoint path, relative to BASE_URL (NOT under /api/v1).
// Default is the root /health/ route. Override with -e HEALTH_PATH=/api/healthz/ once that route exists.
export const HEALTH_PATH = __ENV.HEALTH_PATH || '/health/';

// Card API prefix (the router is mounted at /api/v1/ and registers credit-cards).
export const CARD_API_PATH = '/api/v1/credit-cards';

export const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'k6-load-test/1.0',
};

// A 429 is an expected throttle response, not a failure. Any other 4xx/5xx is.
// k6 counts every status >= 400 as http_req_failed unless a responseCallback says otherwise.
export const EXPECTED_STATUSES = http.expectedStatuses({ min: 200, max: 399 }, 429);

// Steady-state thresholds (smoke, average). Each metric key appears exactly once.
const STEADY_THRESHOLDS = {
  'http_req_duration{type:api}': ['p(95)<200', 'p(99)<500'],
  'http_req_failed': ['rate<0.01'],
  'checks': ['rate>0.99'],
};

// Over-capacity thresholds (stress, spike). Looser by design: they measure degradation, not steady state.
const OVERLOAD_THRESHOLDS = {
  'http_req_duration{type:api}': ['p(95)<500', 'p(99)<1000'],
  'http_req_failed': ['rate<0.05'],
  'checks': ['rate>0.95'],
};

export const THRESHOLDS = STEADY_THRESHOLDS;

// Trend statistics written to the summary. p(99) must be listed or k6 omits it, even when a threshold uses it.
export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

export const SCENARIO_THRESHOLDS = {
  smoke: STEADY_THRESHOLDS,
  average: STEADY_THRESHOLDS,
  stress: OVERLOAD_THRESHOLDS,
  spike: OVERLOAD_THRESHOLDS,
};

// Throttle policy from credit_mate_ai/settings.py (DEFAULT_THROTTLE_RATES; each is env-overridable).
//   anon: THROTTLE_RATE_ANON  default "100/min"   (unauthenticated, keyed by REMOTE_ADDR)
//   user: THROTTLE_RATE_USER  default "1000/min"  (authenticated, keyed by user id)
//   burst: THROTTLE_RATE_BURST default "10/sec"   (applies to both)
// Note: the suite only issues anonymous requests, so the 1000/min user limit is never reached.
export const RATE_LIMITS = {
  anon: { perMinute: 100, burstPerSecond: 10 },
  user: { perMinute: 1000 },
};

const RAMPING_VUS = 'ramping-vus';

// Executor presets. Stage durations drive the phase boundaries in PHASES below.
export const EXECUTOR_PRESETS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  average: {
    executor: RAMPING_VUS,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  stress: {
    executor: RAMPING_VUS,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '3m', target: 200 },
      { duration: '3m', target: 300 },
      { duration: '3m', target: 500 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: RAMPING_VUS,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '30s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
};

// Named phases as [name, end-second] pairs, matching the cumulative stage durations above.
// Phase is picked from elapsed test time (not VU number), so tags are accurate.
export const PHASES = {
  stress: [
    ['warmup', 120],
    ['baseline', 420],
    ['stress', 600],
    ['heavy-stress', 780],
    ['breaking-point', 960],
    ['ramp-down', 1080],
  ],
  spike: [
    ['normal', 60],
    ['spike-ramp-up', 90],
    ['spike-sustain', 150],
    ['spike-ramp-down', 180],
    ['recovery', 240],
    ['ramp-down', 300],
  ],
};

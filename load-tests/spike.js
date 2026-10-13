/**
 * Spike Test - Sudden traffic burst simulation
 * 
 * Simulates flash sale, marketing campaign, or viral event traffic patterns.
 * Use for: Auto-scaling validation, circuit breaker testing, recovery behavior.
 * 
 * Run: k6 run -e BASE_URL=http://localhost:8000 spike.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import config from './config.js';

// Custom metrics
const rateLimitedCounter = new Counter(config.METRIC_NAMES.rateLimited);
const rateLimitedRate = new Rate(config.METRIC_NAMES.rateLimitedRate);
const apiLatency = new Trend('api_latency', true);
const spikePhaseGauge = new Gauge('spike_phase');
const recoveryLatency = new Trend('recovery_latency', true);

// Test configuration
export const options = {
  scenarios: {
    spike: {
      ...config.EXECUTOR_PRESETS.spike,
      tags: { type: 'api' },
    },
  },
  thresholds: config.SCENARIO_THRESHOLDS.spike,
  discardResponseBodies: true,
};

// Test data
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus'
];

const CATEGORIES = ['travel', 'cashback', 'premium', 'student', 'business', 'no-fee'];
const BANKS = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yes', 'indusind', 'rbl'];

let sharedCardIds = [];
let currentPhase = 'normal';

// Phase detection based on VU count and iteration
function detectPhase(vuCount, iter) {
  // Phases based on executor stages:
  // 0-1m: 50 VUs (normal)
  // 1-1.5m: 500 VUs (spike up)
  // 1.5-2.5m: 500 VUs (sustain spike)
  // 2.5-3m: 50 VUs (spike down)
  // 3-4m: 50 VUs (recovery)
  // 4-5m: 0 VUs (ramp down)
  
  if (vuCount >= 400) {
    if (iter < 10) return 'spike-ramp-up';
    return 'spike-sustain';
  } else if (vuCount <= 50) {
    if (iter < 5) return 'spike-ramp-down';
    return 'recovery';
  }
  return 'normal';
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRandomFilters() {
  const filters = {};
  const numFilters = Math.floor(Math.random() * 3);
  const filterTypes = ['category', 'bank', 'sort'];
  const selectedFilters = filterTypes.sort(() => 0.5 - Math.random()).slice(0, numFilters);
  
  for (const type of selectedFilters) {
    switch (type) {
      case 'category': filters.category = pickRandom(CATEGORIES); break;
      case 'bank': filters.bank = pickRandom(BANKS); break;
      case 'sort': filters.sort = pickRandom(['-rewards_rate', 'annual_fee', '-annual_fee', 'apr']); break;
    }
  }
  return filters;
}

// Helper: make request with phase tracking
function makeRequest(method, url, payload = null, params = {}) {
  const requestParams = {
    headers: config.DEFAULT_HEADERS,
    tags: { 
      type: 'api', 
      phase: currentPhase,
      ...params.tags 
    },
    ...params,
  };

  if (payload) {
    requestParams.body = JSON.stringify(payload);
  }

  let response;
  if (method === 'GET') {
    response = http.get(url, requestParams);
  } else if (method === 'POST') {
    response = http.post(url, requestParams.body, requestParams);
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }

  const is429 = config.isRateLimited(response);
  rateLimitedCounter.add(is429 ? 1 : 0);
  rateLimitedRate.add(is429);

  if (!is429 && response.status < 400) {
    apiLatency.add(response.timings.duration);
    if (currentPhase === 'recovery') {
      recoveryLatency.add(response.timings.duration);
    }
  }

  return response;
}

function healthCheck() {
  group('Health Check', () => {
    const res = makeRequest('GET', config.url('/health/'), null, { tags: { endpoint: 'health' } });
    check(res, {
      'health: 200': config.checks.status200,
      'health: < 200ms': config.checks.latencyUnder(200),
    });
  });
}

function listCards() {
  group('List Cards', () => {
    const filters = buildRandomFilters();
    const queryString = new URLSearchParams(filters).toString();
    const path = `/credit-cards/${queryString ? `?${queryString}` : ''}`;
    
    const res = makeRequest('GET', config.url(path), null, { tags: { endpoint: 'list' } });
    
    const success = check(res, {
      'list: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'list: valid JSON': config.checks.isJson,
      'list: < 500ms': config.checks.latencyUnder(500),
    });

    if (success && sharedCardIds.length < 30) {
      try {
        const data = res.json();
        const cards = data.results || data;
        if (Array.isArray(cards)) {
          const ids = cards.map(c => c.id || c.slug).filter(Boolean).slice(0, 5);
          sharedCardIds.push(...ids);
          sharedCardIds = [...new Set(sharedCardIds)];
        }
      } catch {}
    }
  });
}

function cardDetail() {
  group('Card Detail', () => {
    if (sharedCardIds.length === 0) {
      sharedCardIds = Array.from({length: 15}, (_, i) => String(i + 1));
    }
    
    const cardId = pickRandom(sharedCardIds);
    const res = makeRequest('GET', config.url(`/credit-cards/${cardId}/`), null, { 
      tags: { endpoint: 'detail' } 
    });
    
    check(res, {
      'detail: 200/404/429': (r) => [200, 404, 429].includes(r.status),
      'detail: valid JSON if 200': (r) => r.status !== 200 || config.checks.isJson(r),
      'detail: < 500ms': config.checks.latencyUnder(500),
    });
  });
}

function typeahead() {
  group('Typeahead', () => {
    const query = pickRandom(SEARCH_TERMS);
    const res = makeRequest('GET', config.url(`/search-suggestions/?q=${encodeURIComponent(query)}`), null, {
      tags: { endpoint: 'typeahead' }
    });
    
    check(res, {
      'typeahead: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'typeahead: valid JSON': config.checks.isJson,
      'typeahead: < 300ms': config.checks.latencyUnder(300),
    });
  });
}

function advancedSearch() {
  group('Advanced Search', () => {
    const payload = {
      query: pickRandom(SEARCH_TERMS),
      filters: {
        category: Math.random() > 0.5 ? [pickRandom(CATEGORIES)] : undefined,
        annual_fee_max: Math.random() > 0.5 ? Math.floor(Math.random() * 10000) : undefined,
      },
    };
    
    Object.keys(payload.filters).forEach(key => {
      if (payload.filters[key] === undefined) delete payload.filters[key];
    });
    if (Object.keys(payload.filters).length === 0) delete payload.filters;
    
    const res = makeRequest('POST', config.url('/credit-cards/advanced-search/'), payload, {
      tags: { endpoint: 'advanced-search' }
    });
    
    check(res, {
      'adv-search: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'adv-search: valid JSON': config.checks.isJson,
      'adv-search: < 500ms': config.checks.latencyUnder(500),
    });
  });
}

// Main test
export default function (data) {
  currentPhase = detectPhase(__VU, __ITER);
  spikePhaseGauge.add({ 
    normal: 1, 
    'spike-ramp-up': 2, 
    'spike-sustain': 3, 
    'spike-ramp-down': 4, 
    recovery: 5 
  }[currentPhase] || 0);
  
  // During spike, focus on read-heavy operations
  const actions = currentPhase.startsWith('spike') 
    ? [listCards, typeahead, healthCheck]  // Read-heavy during spike
    : [listCards, cardDetail, typeahead, advancedSearch, healthCheck];
  
  const action = pickRandom(actions);
  action();
  
  // Think time varies by phase
  const thinkTimes = {
    'normal': () => sleep(Math.random() * 2 + 0.5),
    'spike-ramp-up': () => sleep(Math.random() * 0.2),
    'spike-sustain': () => sleep(Math.random() * 0.1),
    'spike-ramp-down': () => sleep(Math.random() * 0.5),
    'recovery': () => sleep(Math.random() * 1 + 0.5),
  };
  
  (thinkTimes[currentPhase] || thinkTimes.normal)();
}

// Summary with phase-based analysis
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: 'spike',
    baseUrl: config.BASE_URL,
    thresholds: {},
    metrics: {},
    rateLimited: {
      total: data.metrics[config.METRIC_NAMES.rateLimited]?.values?.count || 0,
      rate: data.metrics[config.METRIC_NAMES.rateLimitedRate]?.values?.rate || 0,
    },
    phaseAnalysis: {},
  };

  // Aggregate metrics
  for (const [key, value] of Object.entries(data.metrics)) {
    if (key.startsWith('http_req') || key.startsWith('checks') || 
        key === 'api_latency' || key === 'recovery_latency' || key === 'spike_phase' ||
        key === config.METRIC_NAMES.rateLimited ||
        key === config.METRIC_NAMES.rateLimitedRate) {
      summary.metrics[key] = value.values;
    }
  }

  // Threshold results
  if (data.root_group?.checks) {
    for (const [checkName, checkData] of Object.entries(data.root_group.checks)) {
      summary.thresholds[checkName] = {
        passes: checkData.passes,
        fails: checkData.fails,
        passRate: checkData.passes / (checkData.passes + checkData.fails) || 0,
      };
    }
  }

  // Phase-specific analysis would require tagged metrics
  // This is a simplified version - full phase analysis needs k6 tags
  const httpReqDuration = data.metrics.http_req_duration?.values;
  if (httpReqDuration) {
    summary.spikeAnalysis = {
      overall: {
        p50Ms: httpReqDuration['p(50)'] || 0,
        p95Ms: httpReqDuration['p(95)'] || 0,
        p99Ms: httpReqDuration['p(99)'] || 0,
        maxMs: httpReqDuration.max || 0,
        errorRate: data.metrics.http_req_failed?.values?.rate || 0,
      },
      rateLimiting: {
        total429: summary.rateLimited.total,
        rate429: summary.rateLimited.rate,
        // Backend allows 100/min anonymous, 10/sec burst
        // At 500 VUs with minimal think time, expect significant 429s
        expected429AtSpike: 'High - 500 VUs >> 100/min anon limit',
      },
      recovery: {
        // Recovery latency should return to normal
        p95RecoveryMs: data.metrics.recovery_latency?.values?.['p(95)'] || 'N/A',
        note: 'Compare recovery p95 to normal p95 - should be similar',
      },
    };
  }

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'spike-results.json': JSON.stringify(summary, null, 2),
  };
}
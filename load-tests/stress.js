/**
 * Stress Test - Push system beyond normal capacity
 * 
 * Gradually increases load to find breaking point and bottlenecks.
 * Use for: Capacity planning, identifying limits, bottleneck analysis.
 * 
 * Run: k6 run -e BASE_URL=http://localhost:8000 stress.js
 * With Prometheus: k6 run --out experimental-prometheus-rw=... stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import config from './config.js';

// Custom metrics
const rateLimitedCounter = new Counter(config.METRIC_NAMES.rateLimited);
const rateLimitedRate = new Rate(config.METRIC_NAMES.rateLimitedRate);
const apiLatency = new Trend('api_latency', true);
const vusGauge = new Gauge('active_vus');
const errorCounter = new Counter('errors_total');
const endpointErrors = new Counter('endpoint_errors_total');

// Test configuration
export const options = {
  scenarios: {
    stress: {
      ...config.EXECUTOR_PRESETS.stress,
      tags: { type: 'api' },
    },
  },
  thresholds: config.SCENARIO_THRESHOLDS.stress,
  discardResponseBodies: true,
};

// Test data - more aggressive than average load
const CATEGORIES = ['travel', 'cashback', 'premium', 'student', 'business', 'no-fee'];
const BANKS = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yes', 'indusind', 'rbl', 'federal', 'idfc'];
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus', 'business',
  'student', 'secured', 'unsecured', 'balance transfer', 'airline'
];

let sharedCardIds = [];
let currentStage = 'warmup';

// Track current VU count for correlation
export function setup() {
  return { startTime: Date.now() };
}

// Helper: make request with 429 tracking
function makeRequest(method, url, payload = null, params = {}) {
  const requestParams = {
    headers: config.DEFAULT_HEADERS,
    tags: { type: 'api', stage: currentStage, ...params.tags },
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
  } else if (response.status >= 400 && response.status !== 429) {
    errorCounter.add(1);
    if (params.tags?.endpoint) {
      endpointErrors.add(1, { endpoint: params.tags.endpoint, status: response.status });
    }
  }

  return response;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRandomFilters() {
  const filters = {};
  const numFilters = Math.floor(Math.random() * 4); // 0-3 filters
  
  const filterTypes = ['category', 'bank', 'annual_fee_range', 'sort'];
  const selectedFilters = filterTypes.sort(() => 0.5 - Math.random()).slice(0, numFilters);
  
  for (const type of selectedFilters) {
    switch (type) {
      case 'category':
        filters.category = pickRandom(CATEGORIES);
        break;
      case 'bank':
        filters.bank = pickRandom(BANKS);
        break;
      case 'annual_fee_range':
        const min = Math.floor(Math.random() * 5000);
        const max = min + Math.floor(Math.random() * 15000);
        filters.annual_fee_min = min;
        filters.annual_fee_max = max;
        break;
      case 'sort':
        filters.sort = pickRandom(['-rewards_rate', 'annual_fee', '-annual_fee', 'apr', '-lounge_visits', 'name']);
        break;
    }
  }
  
  return filters;
}

// Health check
function healthCheck() {
  group('Health Check', () => {
    const res = makeRequest('GET', config.url('/health/'), null, { tags: { endpoint: 'health' } });
    check(res, {
      'health: 200': config.checks.status200,
      'health: < 200ms': config.checks.latencyUnder(200),
    });
  });
}

// List cards - heavier filters
function listCards() {
  group('List Cards (Stress)', () => {
    const filters = buildRandomFilters();
    const queryString = new URLSearchParams(filters).toString();
    const path = `/credit-cards/${queryString ? `?${queryString}` : ''}`;
    
    const res = makeRequest('GET', config.url(path), null, { tags: { endpoint: 'list' } });
    
    const success = check(res, {
      'list: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'list: valid JSON': config.checks.isJson,
      'list: < 500ms': config.checks.latencyUnder(500),
    });

    if (success && sharedCardIds.length < 50) {
      try {
        const data = res.json();
        const cards = data.results || data;
        if (Array.isArray(cards)) {
          const ids = cards.map(c => c.id || c.slug).filter(Boolean).slice(0, 10);
          sharedCardIds.push(...ids);
          sharedCardIds = [...new Set(sharedCardIds)];
        }
      } catch {}
    }
  });
}

// Card detail
function cardDetail() {
  group('Card Detail (Stress)', () => {
    if (sharedCardIds.length === 0) {
      sharedCardIds = Array.from({length: 20}, (_, i) => String(i + 1));
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

// Typeahead
function typeahead() {
  group('Typeahead (Stress)', () => {
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

// Advanced search
function advancedSearch() {
  group('Advanced Search (Stress)', () => {
    const payload = {
      query: pickRandom(SEARCH_TERMS),
      filters: {
        category: Math.random() > 0.3 ? [pickRandom(CATEGORIES), pickRandom(CATEGORIES)] : undefined,
        bank: Math.random() > 0.3 ? [pickRandom(BANKS)] : undefined,
        annual_fee_max: Math.random() > 0.5 ? Math.floor(Math.random() * 15000) : undefined,
        has_lounge_access: Math.random() > 0.5,
        min_rewards_rate: Math.random() > 0.5 ? Math.random() * 5 : undefined,
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

// Determine current stage based on VU count
function updateStage(vuCount) {
  if (vuCount <= 50) currentStage = 'warmup';
  else if (vuCount <= 100) currentStage = 'baseline';
  else if (vuCount <= 200) currentStage = 'stress';
  else if (vuCount <= 300) currentStage = 'heavy-stress';
  else currentStage = 'breaking-point';
}

// Main test - all endpoints hit with equal probability under stress
export default function (data) {
  vusGauge.add(__VU);
  updateStage(__VU);
  
  const actions = [listCards, cardDetail, typeahead, advancedSearch, healthCheck];
  const action = pickRandom(actions);
  action();
  
  // Minimal think time under stress - simulate burst
  sleep(Math.random() * 0.5); // 0-500ms
}

// Teardown with detailed analysis
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: 'stress',
    baseUrl: config.BASE_URL,
    thresholds: {},
    metrics: {},
    rateLimited: {
      total: data.metrics[config.METRIC_NAMES.rateLimited]?.values?.count || 0,
      rate: data.metrics[config.METRIC_NAMES.rateLimitedRate]?.values?.rate || 0,
    },
    errors: {
      total: data.metrics.errors_total?.values?.count || 0,
      byEndpoint: {},
    },
    stages: {},
  };

  // Aggregate metrics
  for (const [key, value] of Object.entries(data.metrics)) {
    if (key.startsWith('http_req') || key.startsWith('checks') || 
        key === 'api_latency' || key === 'active_vus' ||
        key === 'errors_total' || key === 'endpoint_errors_total' ||
        key === config.METRIC_NAMES.rateLimited ||
        key === config.METRIC_NAMES.rateLimitedRate) {
      summary.metrics[key] = value.values;
    }
  }

  // Endpoint errors
  if (data.metrics.endpoint_errors_total?.values) {
    // Would need tag-based aggregation
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

  // Identify breaking point indicators
  const httpReqDuration = data.metrics.http_req_duration?.values;
  if (httpReqDuration) {
    summary.breakingPointIndicators = {
      p95LatencyMs: httpReqDuration['p(95)'] || 0,
      p99LatencyMs: httpReqDuration['p(99)'] || 0,
      meanLatencyMs: httpReqDuration.mean || 0,
      maxLatencyMs: httpReqDuration.max || 0,
      errorRate: data.metrics.http_req_failed?.values?.rate || 0,
      rateLimitRate: summary.rateLimited.rate,
      throughputRps: data.metrics.http_reqs?.values?.rate || 0,
    };
  }

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'stress-results.json': JSON.stringify(summary, null, 2),
  };
}
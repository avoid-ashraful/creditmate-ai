/**
 * Average Load Test - Simulates typical production traffic
 * 
 * Simulates realistic user behavior with sustained load.
 * Use for: Performance baseline, regression detection, capacity planning.
 * 
 * Run: k6 run -e BASE_URL=http://localhost:8000 average-load.js
 * With JSON output: k6 run --out json=results.json average-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import config from './config.js';

// Custom metrics
const rateLimitedCounter = new Counter(config.METRIC_NAMES.rateLimited);
const rateLimitedRate = new Rate(config.METRIC_NAMES.rateLimitedRate);
const apiLatency = new Trend('api_latency', true);
const endpointLatency = new Trend('endpoint_latency', true);

// Test configuration
export const options = {
  scenarios: {
    average_load: {
      ...config.EXECUTOR_PRESETS.average,
      tags: { type: 'api' },
    },
  },
  thresholds: config.SCENARIO_THRESHOLDS.average,
  discardResponseBodies: true,
};

// Realistic user behavior weights (percentages)
const USER_BEHAVIOR = {
  browse_list: 0.40,        // 40% - browse card lists with filters
  view_detail: 0.25,        // 25% - view card details
  search_typeahead: 0.20,   // 20% - typeahead search
  advanced_search: 0.10,    // 10% - advanced search
  health_check: 0.05,       // 5% - health checks (monitoring)
};

// Test data pools
const CATEGORIES = ['travel', 'cashback', 'premium', 'student', 'business', 'no-fee'];
const BANKS = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yes', 'indusind', 'rbl'];
const SORT_OPTIONS = ['-rewards_rate', 'annual_fee', '-annual_fee', 'apr', '-lounge_visits'];
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus'
];

let sharedCardIds = [];

// Helper: make request with 429 tracking
function makeRequest(method, url, payload = null, params = {}) {
  const requestParams = {
    headers: config.DEFAULT_HEADERS,
    tags: { type: 'api', ...params.tags },
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
    if (params.tags?.endpoint) {
      endpointLatency.add(response.timings.duration, { endpoint: params.tags.endpoint });
    }
  }

  return response;
}

// Pick random element from array
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Build random filter combination
function buildRandomFilters() {
  const filters = {};
  const numFilters = Math.floor(Math.random() * 3) + 1; // 1-3 filters
  
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
        const max = min + Math.floor(Math.random() * 10000);
        filters.annual_fee_min = min;
        filters.annual_fee_max = max;
        break;
      case 'sort':
        filters.sort = pickRandom(SORT_OPTIONS);
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
      'health: < 100ms': config.checks.latencyUnder(100),
    });
  });
}

// Browse card list with random filters
function browseList() {
  group('Browse Card List', () => {
    const filters = buildRandomFilters();
    const queryString = new URLSearchParams(filters).toString();
    const path = `/credit-cards/${queryString ? `?${queryString}` : ''}`;
    
    const res = makeRequest('GET', config.url(path), null, { tags: { endpoint: 'list' } });
    
    const success = check(res, {
      'list: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'list: valid JSON': config.checks.isJson,
      'list: < 200ms': config.checks.latencyUnder(200),
    });

    // Collect card IDs for detail views
    if (success && sharedCardIds.length < 20) {
      try {
        const data = res.json();
        const cards = data.results || data;
        if (Array.isArray(cards)) {
          const ids = cards
            .map(c => c.id || c.slug)
            .filter(Boolean)
            .slice(0, 5);
          sharedCardIds.push(...ids);
          // Deduplicate
          sharedCardIds = [...new Set(sharedCardIds)];
        }
      } catch {
        // Ignore
      }
    }
  });
}

// View card detail
function viewDetail() {
  group('View Card Detail', () => {
    if (sharedCardIds.length === 0) {
      // Fallback - try a common pattern
      sharedCardIds = ['1', '2', '3', '4', '5'];
    }
    
    const cardId = pickRandom(sharedCardIds);
    const res = makeRequest('GET', config.url(`/credit-cards/${cardId}/`), null, { 
      tags: { endpoint: 'detail' } 
    });
    
    check(res, {
      'detail: 200/404/429': (r) => [200, 404, 429].includes(r.status),
      'detail: valid JSON if 200': (r) => r.status !== 200 || config.checks.isJson(r),
      'detail: < 200ms': config.checks.latencyUnder(200),
    });
  });
}

// Typeahead search
function typeaheadSearch() {
  group('Typeahead Search', () => {
    const query = pickRandom(SEARCH_TERMS);
    const res = makeRequest('GET', config.url(`/search-suggestions/?q=${encodeURIComponent(query)}`), null, {
      tags: { endpoint: 'typeahead' }
    });
    
    check(res, {
      'typeahead: 200 or 429': (r) => r.status === 200 || r.status === 429,
      'typeahead: valid JSON': config.checks.isJson,
      'typeahead: < 150ms': config.checks.latencyUnder(150),
    });
  });
}

// Advanced search
function advancedSearch() {
  group('Advanced Search', () => {
    const payload = {
      query: pickRandom(SEARCH_TERMS),
      filters: {
        category: Math.random() > 0.5 ? [pickRandom(CATEGORIES)] : undefined,
        bank: Math.random() > 0.5 ? [pickRandom(BANKS)] : undefined,
        annual_fee_max: Math.random() > 0.5 ? Math.floor(Math.random() * 10000) : undefined,
        has_lounge_access: Math.random() > 0.7,
      },
      // Remove undefined values
    };
    
    // Clean undefined
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
      'adv-search: < 300ms': config.checks.latencyUnder(300),
    });
  });
}

// Simulate realistic think time (user reading time)
function thinkTime() {
  // Log-normal distribution: most users think 1-3s, some longer
  const u = Math.random();
  const think = Math.exp(0.5 + 0.5 * Math.sqrt(2) * Math.erfcinv(2 * u)); // Approximate log-normal
  sleep(Math.min(Math.max(think, 0.5), 10)); // Clamp 0.5-10s
}

// Main test function - weighted user behavior
export default function () {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [action, weight] of Object.entries(USER_BEHAVIOR)) {
    cumulative += weight;
    if (rand <= cumulative) {
      switch (action) {
        case 'browse_list':
          browseList();
          break;
        case 'view_detail':
          viewDetail();
          break;
        case 'search_typeahead':
          typeaheadSearch();
          break;
        case 'advanced_search':
          advancedSearch();
          break;
        case 'health_check':
          healthCheck();
          break;
      }
      break;
    }
  }
  
  thinkTime();
}

// Summary handler for JSON/Grafana output
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: 'average-load',
    baseUrl: config.BASE_URL,
    duration: data.state?.testRunDurationMs || 0,
    thresholds: {},
    metrics: {},
    rateLimited: {
      total: data.metrics[config.METRIC_NAMES.rateLimited]?.values?.count || 0,
      rate: data.metrics[config.METRIC_NAMES.rateLimitedRate]?.values?.rate || 0,
    },
    endpoints: {},
  };

  // Per-endpoint metrics
  if (data.metrics.endpoint_latency?.values) {
    // This would need custom aggregation per endpoint tag
    // For now, include overall metrics
  }

  for (const [key, value] of Object.entries(data.metrics)) {
    if (key.startsWith('http_req') || key.startsWith('checks') || 
        key === 'api_latency' || key === 'endpoint_latency' ||
        key === config.METRIC_NAMES.rateLimited ||
        key === config.METRIC_NAMES.rateLimitedRate) {
      summary.metrics[key] = value.values;
    }
  }

  if (data.root_group?.checks) {
    for (const [checkName, checkData] of Object.entries(data.root_group.checks)) {
      summary.thresholds[checkName] = {
        passes: checkData.passes,
        fails: checkData.fails,
        passRate: checkData.passes / (checkData.passes + checkData.fails) || 0,
      };
    }
  }

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'average-load-results.json': JSON.stringify(summary, null, 2),
  };
}

// Helper for log-normal inverse (approximation)
// Using simple approximation for think time
Math.erfcinv = function(x) {
  // Approximation of inverse complementary error function
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const sqrt = Math.sqrt(Math.sqrt((2 / (Math.PI * a) + ln / 2) ** 2 - ln / a) - (2 / (Math.PI * a) + ln / 2));
  return x >= 0 ? sqrt : -sqrt;
};
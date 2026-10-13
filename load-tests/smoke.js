/**
 * Smoke Test - Basic functionality verification
 * 
 * Runs a minimal load to verify API endpoints work correctly.
 * Use for: CI/CD pipeline, pre-deployment checks, quick validation.
 * 
 * Run: k6 run -e BASE_URL=http://localhost:8000 smoke.js
 * Quick syntax check: node --check smoke.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import config from './config.js';

// Custom metrics for 429 tracking
const rateLimitedCounter = new Counter(config.METRIC_NAMES.rateLimited);
const rateLimitedRate = new Rate(config.METRIC_NAMES.rateLimitedRate);
const apiLatency = new Trend('api_latency', true);

// Test configuration
export const options = {
  scenarios: {
    smoke: {
      ...config.EXECUTOR_PRESETS.smoke,
      tags: { type: 'api' },
    },
  },
  thresholds: config.SCENARIO_THRESHOLDS.smoke,
  // Discard response bodies by default to save memory
  discardResponseBodies: true,
};

// Test data - using realistic query parameters
const TEST_PARAMS = {
  // List cards with filters
  listFilters: [
    {},                                      // No filters
    { category: 'travel' },                  // Category filter
    { annual_fee_min: 0, annual_fee_max: 5000 }, // Fee range
    { bank: 'hdfc' },                        // Bank filter
    { category: 'cashback', sort: '-rewards_rate' }, // Combined
  ],
  // Card IDs for detail endpoint (will be fetched from list)
  // Typeahead queries
  typeaheadQueries: ['visa', 'master', 'travel', 'cash', 'premium'],
  // Advanced search payloads
  advancedSearch: [
    { query: 'travel rewards', filters: { category: ['travel'] } },
    { query: 'no annual fee', filters: { annual_fee_max: 0 } },
    { query: 'lounge access', filters: { has_lounge_access: true } },
  ],
};

let cachedCardIds = [];

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

  // Track 429 responses separately
  const is429 = config.isRateLimited(response);
  rateLimitedCounter.add(is429 ? 1 : 0);
  rateLimitedRate.add(is429);

  // Track latency for successful requests
  if (!is429 && response.status < 400) {
    apiLatency.add(response.timings.duration);
  }

  return response;
}

// Health check endpoint
function testHealth() {
  group('Health Check', () => {
    const res = makeRequest('GET', config.url('/health/'));
    check(res, {
      'health: status 200': config.checks.status200,
      'health: response ok': config.checks.hasBody,
      'health: latency < 100ms': config.checks.latencyUnder(100),
    });
  });
}

// List credit cards with various filters
function testListCards() {
  group('List Credit Cards', () => {
    for (const filters of TEST_PARAMS.listFilters) {
      const queryString = new URLSearchParams(filters).toString();
      const path = `/credit-cards/${queryString ? `?${queryString}` : ''}`;
      
      const res = makeRequest('GET', config.url(path));
      
      const success = check(res, {
        'list: status 200 or 429': (r) => r.status === 200 || r.status === 429,
        'list: valid JSON': config.checks.isJson,
        'list: has results array': (r) => {
          try {
            const data = r.json();
            return Array.isArray(data.results) || Array.isArray(data);
          } catch {
            return false;
          }
        },
        'list: latency < 200ms': config.checks.latencyUnder(200),
      });

      // Cache card IDs for detail tests (only on first successful request)
      if (success && cachedCardIds.length === 0) {
        try {
          const data = res.json();
          const cards = data.results || data;
          if (Array.isArray(cards) && cards.length > 0) {
            cachedCardIds = cards.slice(0, 5).map(c => c.id || c.slug).filter(Boolean);
          }
        } catch {
          // Ignore parsing errors
        }
      }

      sleep(0.1); // Small delay between filter tests
    }
  });
}

// Card detail endpoint
function testCardDetail() {
  group('Card Detail', () => {
    if (cachedCardIds.length === 0) {
      // Fallback: try a known pattern
      cachedCardIds = ['test-card-1', 'test-card-2'];
    }

    for (const cardId of cachedCardIds) {
      const res = makeRequest('GET', config.url(`/credit-cards/${cardId}/`));
      
      check(res, {
        'detail: status 200 or 404 or 429': (r) => [200, 404, 429].includes(r.status),
        'detail: valid JSON if 200': (r) => r.status !== 200 || config.checks.isJson(r),
        'detail: latency < 200ms': config.checks.latencyUnder(200),
      });

      sleep(0.1);
    }
  });
}

// Typeahead / search suggestions
function testTypeahead() {
  group('Typeahead / Search Suggestions', () => {
    for (const query of TEST_PARAMS.typeaheadQueries) {
      const res = makeRequest('GET', config.url(`/search-suggestions/?q=${encodeURIComponent(query)}`));
      
      check(res, {
        'typeahead: status 200 or 429': (r) => r.status === 200 || r.status === 429,
        'typeahead: valid JSON': config.checks.isJson,
        'typeahead: latency < 150ms': config.checks.latencyUnder(150),
      });

      sleep(0.1);
    }
  });
}

// Advanced search endpoint
function testAdvancedSearch() {
  group('Advanced Search', () => {
    for (const payload of TEST_PARAMS.advancedSearch) {
      const res = makeRequest('POST', config.url('/credit-cards/advanced-search/'), payload);
      
      check(res, {
        'advanced-search: status 200 or 429': (r) => r.status === 200 || r.status === 429,
        'advanced-search: valid JSON': config.checks.isJson,
        'advanced-search: has results': (r) => {
          try {
            const data = r.json();
            return Array.isArray(data.results) || Array.isArray(data);
          } catch {
            return false;
          }
        },
        'advanced-search: latency < 300ms': config.checks.latencyUnder(300),
      });

      sleep(0.2);
    }
  });
}

// Main test function
export default function () {
  testHealth();
  sleep(0.5);
  
  testListCards();
  sleep(0.5);
  
  testCardDetail();
  sleep(0.5);
  
  testTypeahead();
  sleep(0.5);
  
  testAdvancedSearch();
}

// Teardown - summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: 'smoke',
    baseUrl: config.BASE_URL,
    thresholds: {},
    metrics: {},
    rateLimited: {
      total: data.metrics[config.METRIC_NAMES.rateLimited]?.values?.count || 0,
      rate: data.metrics[config.METRIC_NAMES.rateLimitedRate]?.values?.rate || 0,
    },
  };

  // Extract threshold results
  for (const [key, value] of Object.entries(data.metrics)) {
    if (key.startsWith('http_req') || key.startsWith('checks') || key === 'api_latency') {
      summary.metrics[key] = value.values;
    }
  }

  // Check threshold pass/fail
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
    'summary.json': JSON.stringify(summary, null, 2),
  };
}
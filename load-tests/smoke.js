/**
 * Smoke test - one virtual user exercising every public read endpoint once per iteration.
 *
 * Use for: pre-deploy checks, validating the suite against a local stub, quick regressions.
 *
 * Run:   k6 run -e BASE_URL=http://localhost:8000 smoke.js
 * Check: k6 inspect smoke.js
 */

import { check, group, sleep } from 'k6';
import { SCENARIO_THRESHOLDS, EXECUTOR_PRESETS, SUMMARY_TREND_STATS } from './config.js';
import {
  advancedSearchUrl,
  advancedSubRouteUrl,
  detailUrl,
  fetchCardIds,
  get,
  healthUrl,
  listUrl,
  okOrLimited,
  parseJson,
  searchSuggestionsUrl,
  summarize,
  typeaheadUrl,
  latencyUnder,
} from './lib.js';

export const options = {
  scenarios: {
    smoke: {
      ...EXECUTOR_PRESETS.smoke,
      tags: { type: 'api' },
    },
  },
  thresholds: SCENARIO_THRESHOLDS.smoke,
  // Bodies are parsed for shape checks, so they must not be discarded.
  discardResponseBodies: false,
  summaryTrendStats: SUMMARY_TREND_STATS,
};

// Every query uses parameter names the backend actually reads (see filters.py / advanced_filters.py).
const LIST_QUERIES = [
  {},
  { bank_name: 'HDFC' },
  { annual_fee_min: 0, annual_fee_max: 5000 },
  { has_lounge_access: 'true' },
  { no_annual_fee: 'true', ordering: 'name' },
  { search: 'travel' },
];

const TYPEAHEAD_QUERIES = ['visa', 'master', 'travel', 'cash', 'premium'];

const ADVANCED_QUERIES = [
  { search: 'travel rewards', categories: 'travel' },
  { no_annual_fee: 'true' },
  { has_international_lounge: 'true', ordering: 'annual_fee' },
  { categories: 'travel,cashback', annual_fee_max: 3000, page_size: 10 },
];

// Real card IDs come from the list endpoint, fetched once before the iterations.
export function setup() {
  return { cardIds: fetchCardIds(5) };
}

function testHealth() {
  group('health', () => {
    const res = get(healthUrl(), 'health');
    check(res, {
      'health: 200': (r) => r.status === 200,
      'health: body present': (r) => r.body && r.body.length > 0,
      'health: latency < 100ms': latencyUnder(100),
    });
  });
}

function testList() {
  group('list', () => {
    for (const params of LIST_QUERIES) {
      const res = get(listUrl(params), 'list');
      check(res, {
        'list: 200 or 429': okOrLimited,
        'list: results array': (r) => r.status === 429 || Array.isArray(parseJson(r)?.results),
        'list: latency < 200ms': latencyUnder(200),
      });
      sleep(0.1);
    }
  });
}

function testDetail(cardIds) {
  group('detail', () => {
    for (const id of cardIds) {
      const res = get(detailUrl(id), 'detail');
      check(res, {
        'detail: 200 or 429': okOrLimited,
        'detail: id matches': (r) => r.status === 429 || String(parseJson(r)?.id) === String(id),
        'detail: latency < 200ms': latencyUnder(200),
      });
      sleep(0.1);
    }
  });
}

function testSearchSuggestions() {
  group('search-suggestions', () => {
    // The backend currently ignores q on this route; it is sent to match the documented endpoint.
    const res = get(searchSuggestionsUrl({ q: 'travel' }), 'search-suggestions');
    check(res, {
      'search-suggestions: 200 or 429': okOrLimited,
      'search-suggestions: JSON object': (r) => r.status === 429 || typeof parseJson(r) === 'object',
    });
    sleep(0.1);
  });
}

function testTypeahead() {
  group('typeahead', () => {
    for (const q of TYPEAHEAD_QUERIES) {
      const res = get(typeaheadUrl(q), 'typeahead');
      check(res, {
        'typeahead: 200 or 429': okOrLimited,
        'typeahead: latency < 150ms': latencyUnder(150),
      });
      sleep(0.1);
    }
    // One-character query: the backend returns 200 with match_policy.active = false.
    const short = get(typeaheadUrl('v'), 'typeahead');
    check(short, {
      'typeahead: 1 char inactive': (r) =>
        r.status === 429 || parseJson(r)?.match_policy?.active === false,
    });
    sleep(0.1);
  });
}

function testAdvancedSearch() {
  group('advanced-search', () => {
    for (const params of ADVANCED_QUERIES) {
      const res = get(advancedSearchUrl(params), 'advanced-search');
      check(res, {
        'advanced-search: 200 or 429': okOrLimited,
        'advanced-search: results array': (r) => r.status === 429 || Array.isArray(parseJson(r)?.results),
        'advanced-search: latency < 300ms': latencyUnder(300),
      });
      sleep(0.2);
    }
  });

  group('advanced-search sub-routes', () => {
    const sortOptions = get(advancedSubRouteUrl('sort-options'), 'sort-options');
    check(sortOptions, {
      'sort-options: 200 or 429': okOrLimited,
      'sort-options: list present': (r) => r.status === 429 || Array.isArray(parseJson(r)?.sort_options),
    });

    const categories = get(advancedSubRouteUrl('categories'), 'categories');
    check(categories, {
      'categories: 200 or 429': okOrLimited,
      'categories: list present': (r) => r.status === 429 || Array.isArray(parseJson(r)?.categories),
    });

    const normalize = get(
      advancedSubRouteUrl('normalize') + '?categories=cashback,travel&search=%20travel%20',
      'normalize',
    );
    check(normalize, {
      'normalize: 200 or 429': okOrLimited,
      'normalize: canonical query': (r) =>
        r.status === 429 || parseJson(r)?.normalized_query?.categories === 'cashback,travel',
    });
    sleep(0.2);
  });
}

export default function (data) {
  testHealth();
  sleep(0.5);

  testList();
  sleep(0.5);

  testDetail(data.cardIds);
  sleep(0.5);

  testSearchSuggestions();
  testTypeahead();
  sleep(0.5);

  testAdvancedSearch();
}

export function handleSummary(data) {
  return summarize('smoke', data);
}

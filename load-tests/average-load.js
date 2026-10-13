/**
 * Average load test - weighted, read-only user behaviour under sustained traffic.
 *
 * Use for: performance baselines, regression detection, capacity planning.
 *
 * Run:   k6 run -e BASE_URL=http://localhost:8000 average-load.js
 * Check: k6 inspect average-load.js
 */

import { check, group, sleep } from 'k6';
import { EXECUTOR_PRESETS, SCENARIO_THRESHOLDS, SUMMARY_TREND_STATS } from './config.js';
import {
  advancedSearchUrl,
  detailUrl,
  fetchCardIds,
  get,
  healthUrl,
  listUrl,
  logNormalSeconds,
  okOrLimited,
  pickRandom,
  summarize,
  typeaheadUrl,
  latencyUnder,
} from './lib.js';

export const options = {
  scenarios: {
    average_load: {
      ...EXECUTOR_PRESETS.average,
      tags: { type: 'api' },
    },
  },
  thresholds: SCENARIO_THRESHOLDS.average,
  discardResponseBodies: false,
  summaryTrendStats: SUMMARY_TREND_STATS,
};

// Share of iterations per user action. Must sum to 1.
const USER_BEHAVIOR = [
  ['browse_list', 0.40],
  ['view_detail', 0.25],
  ['typeahead', 0.20],
  ['advanced_search', 0.10],
  ['health_check', 0.05],
];

// Values the backend accepts (see credit_cards/api/advanced_filters.py and filters.py).
const BANK_NAMES = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Yes', 'IndusInd', 'RBL'];
const CATEGORY_SLUGS = ['travel', 'cashback', 'premium', 'student', 'business', 'no-annual-fee'];
const LIST_ORDERING = ['name', '-name', 'annual_fee', '-annual_fee', 'interest_rate_apr', '-interest_rate_apr'];
const ADVANCED_ORDERING = ['annual_fee', '-annual_fee', 'interest_rate_apr', '-interest_rate_apr', 'name', '-created'];
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus',
];

// Random list filters: 1-3 of bank, fee range, lounge, ordering.
function buildListParams() {
  const params = {};
  const choices = ['bank', 'fee', 'lounge', 'ordering'];
  const count = 1 + Math.floor(Math.random() * 3);
  for (const pick of choices.sort(() => 0.5 - Math.random()).slice(0, count)) {
    if (pick === 'bank') params.bank_name = pickRandom(BANK_NAMES);
    if (pick === 'fee') {
      const min = Math.floor(Math.random() * 5000);
      params.annual_fee_min = min;
      params.annual_fee_max = min + Math.floor(Math.random() * 10000);
    }
    if (pick === 'lounge') params.has_lounge_access = 'true';
    if (pick === 'ordering') params.ordering = pickRandom(LIST_ORDERING);
  }
  return params;
}

function healthCheck() {
  group('health', () => {
    const res = get(healthUrl(), 'health');
    check(res, {
      'health: 200': (r) => r.status === 200,
      'health: < 100ms': latencyUnder(100),
    });
  });
}

function browseList() {
  group('browse list', () => {
    const res = get(listUrl(buildListParams()), 'list');
    check(res, {
      'list: 200 or 429': okOrLimited,
      'list: < 200ms': latencyUnder(200),
    });
  });
}

function viewDetail(cardIds) {
  group('view detail', () => {
    const res = get(detailUrl(pickRandom(cardIds)), 'detail');
    check(res, {
      'detail: 200 or 429': okOrLimited,
      'detail: < 200ms': latencyUnder(200),
    });
  });
}

function typeaheadSearch() {
  group('typeahead', () => {
    const res = get(typeaheadUrl(pickRandom(SEARCH_TERMS)), 'typeahead');
    check(res, {
      'typeahead: 200 or 429': okOrLimited,
      'typeahead: < 150ms': latencyUnder(150),
    });
  });
}

function advancedSearch() {
  group('advanced search', () => {
    const params = { search: pickRandom(SEARCH_TERMS), ordering: pickRandom(ADVANCED_ORDERING) };
    if (Math.random() > 0.5) params.categories = pickRandom(CATEGORY_SLUGS);
    if (Math.random() > 0.5) params.bank_name = pickRandom(BANK_NAMES);
    if (Math.random() > 0.5) params.annual_fee_max = Math.floor(Math.random() * 10000);
    if (Math.random() > 0.7) params.has_lounge_access = 'true';

    const res = get(advancedSearchUrl(params), 'advanced-search');
    check(res, {
      'advanced-search: 200 or 429': okOrLimited,
      'advanced-search: < 300ms': latencyUnder(300),
    });
  });
}

// Log-normal think time (median ~1.5s), clamped to 0.5-10s.
function thinkTime() {
  sleep(logNormalSeconds(Math.log(1.5), 0.5, 0.5, 10));
}

function runAction(action, cardIds) {
  switch (action) {
    case 'browse_list':
      return browseList();
    case 'view_detail':
      return viewDetail(cardIds);
    case 'typeahead':
      return typeaheadSearch();
    case 'advanced_search':
      return advancedSearch();
    default:
      return healthCheck();
  }
}

export function setup() {
  return { cardIds: fetchCardIds(20) };
}

export default function (data) {
  const roll = Math.random();
  let cumulative = 0;
  for (const [action, weight] of USER_BEHAVIOR) {
    cumulative += weight;
    if (roll <= cumulative) {
      runAction(action, data.cardIds);
      break;
    }
  }
  thinkTime();
}

export function handleSummary(data) {
  return summarize('average', data);
}

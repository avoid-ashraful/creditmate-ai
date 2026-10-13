/**
 * Stress test - ramps well past the normal load to find where latency and errors break.
 *
 * Use for: capacity planning, identifying limits, bottleneck analysis.
 * Note: anonymous traffic from one source IP hits the 100/min and 10/sec throttles quickly,
 * so most of the signal at high VU counts is 429s. Use the rate_limited_429_* metrics to read it.
 *
 * Run:   k6 run -e BASE_URL=http://localhost:8000 stress.js
 * Check: k6 inspect stress.js
 */

import { check, group, sleep } from 'k6';
import { EXECUTOR_PRESETS, SCENARIO_THRESHOLDS, SUMMARY_TREND_STATS } from './config.js';
import {
  advancedSearchUrl,
  currentPhase,
  detailUrl,
  fetchCardIds,
  get,
  healthUrl,
  listUrl,
  okOrLimited,
  pickRandom,
  summarize,
  typeaheadUrl,
  latencyUnder,
} from './lib.js';

export const options = {
  scenarios: {
    stress: {
      ...EXECUTOR_PRESETS.stress,
      tags: { type: 'api' },
    },
  },
  thresholds: SCENARIO_THRESHOLDS.stress,
  discardResponseBodies: false,
  summaryTrendStats: SUMMARY_TREND_STATS,
};

const BANK_NAMES = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Yes', 'IndusInd', 'RBL', 'Federal', 'IDFC'];
const CATEGORY_SLUGS = ['travel', 'cashback', 'premium', 'student', 'business', 'no-annual-fee'];
const LIST_ORDERING = ['name', '-name', 'annual_fee', '-annual_fee', 'interest_rate_apr', '-interest_rate_apr'];
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus', 'business',
  'student', 'secured', 'unsecured', 'balance transfer', 'airline',
];

// Random list filters, 0-3 of them, using only names the list endpoint reads.
function buildListParams() {
  const params = {};
  const choices = ['bank', 'fee', 'ordering'];
  const count = Math.floor(Math.random() * 4);
  for (const pick of choices.sort(() => 0.5 - Math.random()).slice(0, count)) {
    if (pick === 'bank') params.bank_name = pickRandom(BANK_NAMES);
    if (pick === 'fee') {
      const min = Math.floor(Math.random() * 5000);
      params.annual_fee_min = min;
      params.annual_fee_max = min + Math.floor(Math.random() * 15000);
    }
    if (pick === 'ordering') params.ordering = pickRandom(LIST_ORDERING);
  }
  return params;
}

function healthCheck(phase) {
  group('health', () => {
    const res = get(healthUrl(), 'health', { phase });
    check(res, {
      'health: 200': (r) => r.status === 200,
      'health: < 200ms': latencyUnder(200),
    });
  });
}

function listCards(phase) {
  group('list', () => {
    const res = get(listUrl(buildListParams()), 'list', { phase });
    check(res, {
      'list: 200 or 429': okOrLimited,
      'list: < 500ms': latencyUnder(500),
    });
  });
}

function cardDetail(cardIds, phase) {
  group('detail', () => {
    const res = get(detailUrl(pickRandom(cardIds)), 'detail', { phase });
    check(res, {
      'detail: 200 or 429': okOrLimited,
      'detail: < 500ms': latencyUnder(500),
    });
  });
}

function typeahead(phase) {
  group('typeahead', () => {
    const res = get(typeaheadUrl(pickRandom(SEARCH_TERMS)), 'typeahead', { phase });
    check(res, {
      'typeahead: 200 or 429': okOrLimited,
      'typeahead: < 300ms': latencyUnder(300),
    });
  });
}

function advancedSearch(phase) {
  group('advanced search', () => {
    const params = { search: pickRandom(SEARCH_TERMS) };
    if (Math.random() > 0.3) params.categories = pickRandom(CATEGORY_SLUGS);
    if (Math.random() > 0.3) params.bank_name = pickRandom(BANK_NAMES);
    if (Math.random() > 0.5) params.annual_fee_max = Math.floor(Math.random() * 15000);
    if (Math.random() > 0.5) params.has_lounge_access = 'true';

    const res = get(advancedSearchUrl(params), 'advanced-search', { phase });
    check(res, {
      'advanced-search: 200 or 429': okOrLimited,
      'advanced-search: < 500ms': latencyUnder(500),
    });
  });
}

export function setup() {
  return { cardIds: fetchCardIds(20) };
}

export default function (data) {
  const phase = currentPhase('stress');
  const actions = [
    () => listCards(phase),
    () => cardDetail(data.cardIds, phase),
    () => typeahead(phase),
    () => advancedSearch(phase),
    () => healthCheck(phase),
  ];
  pickRandom(actions)();

  // Short think time keeps pressure high without a zero-sleep spin.
  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  return summarize('stress', data);
}

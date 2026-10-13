/**
 * Spike test - sudden traffic burst, then recovery.
 *
 * Use for: burst protection (10/sec throttle), auto-scaling validation, recovery behaviour.
 * Phases are chosen from elapsed test time (see PHASES in config.js), and every request is
 * tagged with its phase so the per-phase latency can be read from the tagged metrics.
 *
 * Run:   k6 run -e BASE_URL=http://localhost:8000 spike.js
 * Check: k6 inspect spike.js
 */

import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
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
    spike: {
      ...EXECUTOR_PRESETS.spike,
      tags: { type: 'api' },
    },
  },
  thresholds: SCENARIO_THRESHOLDS.spike,
  discardResponseBodies: false,
  summaryTrendStats: SUMMARY_TREND_STATS,
};

const recoveryLatency = new Trend('recovery_latency', true);

const BANK_NAMES = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Yes', 'IndusInd', 'RBL'];
const CATEGORY_SLUGS = ['travel', 'cashback', 'premium', 'student', 'business', 'no-annual-fee'];
const LIST_ORDERING = ['name', 'annual_fee', '-annual_fee', 'interest_rate_apr'];
const SEARCH_TERMS = [
  'visa', 'mastercard', 'travel', 'cashback', 'premium', 'lounge',
  'fuel', 'dining', 'shopping', 'international', 'domestic',
  'no fee', 'low apr', 'high rewards', 'welcome bonus',
];

// Think time per phase: near-zero during the spike, longer when the load is normal.
const THINK_SECONDS = {
  'normal': [0.5, 2.5],
  'spike-ramp-up': [0, 0.2],
  'spike-sustain': [0, 0.1],
  'spike-ramp-down': [0, 0.5],
  'recovery': [0.5, 1.5],
  'ramp-down': [0, 0.5],
};

// Record latency for the recovery window so it can be compared with the normal-phase latency.
function track(res, phase) {
  if (phase === 'recovery') recoveryLatency.add(res.timings.duration);
  return res;
}

function buildListParams() {
  const params = {};
  if (Math.random() > 0.5) params.bank_name = pickRandom(BANK_NAMES);
  if (Math.random() > 0.5) params.ordering = pickRandom(LIST_ORDERING);
  return params;
}

function healthCheck(phase) {
  group('health', () => {
    const res = track(get(healthUrl(), 'health', { phase }), phase);
    check(res, {
      'health: 200 or 429': okOrLimited,
      'health: < 200ms': latencyUnder(200),
    });
  });
}

function listCards(phase) {
  group('list', () => {
    const res = track(get(listUrl(buildListParams()), 'list', { phase }), phase);
    check(res, {
      'list: 200 or 429': okOrLimited,
      'list: < 500ms': latencyUnder(500),
    });
  });
}

function cardDetail(cardIds, phase) {
  group('detail', () => {
    const res = track(get(detailUrl(pickRandom(cardIds)), 'detail', { phase }), phase);
    check(res, {
      'detail: 200 or 429': okOrLimited,
      'detail: < 500ms': latencyUnder(500),
    });
  });
}

function typeahead(phase) {
  group('typeahead', () => {
    const res = track(get(typeaheadUrl(pickRandom(SEARCH_TERMS)), 'typeahead', { phase }), phase);
    check(res, {
      'typeahead: 200 or 429': okOrLimited,
      'typeahead: < 300ms': latencyUnder(300),
    });
  });
}

function advancedSearch(phase) {
  group('advanced search', () => {
    const params = { categories: pickRandom(CATEGORY_SLUGS) };
    if (Math.random() > 0.5) params.annual_fee_max = Math.floor(Math.random() * 10000);
    const res = track(get(advancedSearchUrl(params), 'advanced-search', { phase }), phase);
    check(res, {
      'advanced-search: 200 or 429': okOrLimited,
      'advanced-search: < 500ms': latencyUnder(500),
    });
  });
}

export function setup() {
  return { cardIds: fetchCardIds(15) };
}

export default function (data) {
  const phase = currentPhase('spike');

  // During the spike, only read-heavy actions that are cheap to serve; full mix otherwise.
  const spiking = phase.startsWith('spike');
  const actions = spiking
    ? [() => listCards(phase), () => typeahead(phase), () => healthCheck(phase)]
    : [
      () => listCards(phase),
      () => cardDetail(data.cardIds, phase),
      () => typeahead(phase),
      () => advancedSearch(phase),
      () => healthCheck(phase),
    ];
  pickRandom(actions)();

  const [minSec, maxSec] = THINK_SECONDS[phase] || THINK_SECONDS.normal;
  sleep(minSec + Math.random() * (maxSec - minSec));
}

export function handleSummary(data) {
  return summarize('spike', data);
}

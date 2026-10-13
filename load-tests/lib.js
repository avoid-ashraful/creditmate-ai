/**
 * Shared helpers for the k6 scenarios: URL builders, request wrapper with
 * 429 tracking, phase lookup, and the common summary writer.
 */

import http from 'k6/http';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  CARD_API_PATH,
  DEFAULT_HEADERS,
  EXPECTED_STATUSES,
  HEALTH_PATH,
  PHASES,
  SCENARIO_THRESHOLDS,
} from './config.js';

export const rateLimitedTotal = new Counter('rate_limited_429_total');
export const rateLimitedRate = new Rate('rate_limited_429_rate');
export const apiLatency = new Trend('api_latency', true);

// ---- URL builders ---------------------------------------------------------

// "?k=v&..." from params, dropping empty/undefined values; "" when nothing is set.
export function queryString(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// DRF routes end in "/", and the query string follows the slash.
export const healthUrl = () => `${BASE_URL}${HEALTH_PATH}`;
export const listUrl = (params) => `${BASE_URL}${CARD_API_PATH}/${queryString(params)}`;
export const detailUrl = (id) => `${BASE_URL}${CARD_API_PATH}/${id}/`;
export const searchSuggestionsUrl = (params) =>
  `${BASE_URL}${CARD_API_PATH}/search-suggestions/${queryString(params)}`;
export const typeaheadUrl = (q) => `${BASE_URL}${CARD_API_PATH}/typeahead/${queryString({ q })}`;
export const advancedSearchUrl = (params) =>
  `${BASE_URL}${CARD_API_PATH}/advanced-search/${queryString(params)}`;
export const advancedSubRouteUrl = (name) => `${BASE_URL}${CARD_API_PATH}/advanced-search/${name}/`;

// ---- Requests -------------------------------------------------------------

// GET with 429 tracking and latency capture. Only GET is used by this suite:
// every real search endpoint is a GET with query parameters.
// `extraTags` lets overload scenarios add a `phase` tag for per-phase analysis.
export function get(url, endpoint, extraTags = {}) {
  const res = http.get(url, {
    headers: DEFAULT_HEADERS,
    tags: { type: 'api', endpoint, ...extraTags },
    responseCallback: EXPECTED_STATUSES,
  });

  const limited = res.status === 429;
  rateLimitedTotal.add(limited ? 1 : 0);
  rateLimitedRate.add(limited);
  if (!limited && res.status < 400) {
    apiLatency.add(res.timings.duration);
  }
  return res;
}

// Parse a JSON body; returns null on failure instead of throwing inside checks.
export function parseJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

// A 429 is an accepted outcome for checks; a 200 must also carry a valid body.
export const okOrLimited = (r) => r.status === 200 || r.status === 429;

// Per-request latency check, measured on the full request duration.
export const latencyUnder = (ms) => (r) => r.timings.duration < ms;

// Card list payload: paginated { results: [...] }.
export function cardsFrom(res) {
  const body = parseJson(res);
  return body && Array.isArray(body.results) ? body.results : [];
}

// ---- Setup helpers --------------------------------------------------------

// Fetch real card IDs from the list endpoint so detail requests hit existing
// records. Throws when none are found, so a misconfigured target fails loudly.
export function fetchCardIds(count = 10) {
  const res = get(listUrl({}), 'setup-list');
  if (res.status !== 200) {
    throw new Error(`setup: list returned ${res.status}; cannot select card IDs`);
  }
  const ids = cardsFrom(res).slice(0, count).map((c) => c.id).filter((id) => id !== undefined);
  if (ids.length === 0) {
    throw new Error('setup: list returned no cards; detail checks would be meaningless');
  }
  return ids;
}

// ---- Phases and randomness -----------------------------------------------

// Name of the phase containing the current elapsed test time, or 'unknown'.
export function currentPhase(phaseKey) {
  const elapsedSec = exec.instance.currentTestRunDuration / 1000;
  for (const [name, endSec] of PHASES[phaseKey]) {
    if (elapsedSec < endSec) return name;
  }
  return PHASES[phaseKey][PHASES[phaseKey].length - 1][0];
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Log-normal sample via Box-Muller: median exp(mu), clamped to [min, max] seconds.
export function logNormalSeconds(mu, sigma, min, max) {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(Math.max(Math.exp(mu + sigma * z), min), max);
}

// ---- Summary --------------------------------------------------------------

// Shared handleSummary body: writes <scenario>-results.json and echoes it to stdout.
// Includes every threshold with its pass/fail flag so a silently overwritten
// threshold (the earlier duplicate-key bug) would show up as a missing entry.
export function summarize(scenario, data) {
  const metrics = {};
  const thresholds = [];

  for (const [name, metric] of Object.entries(data.metrics)) {
    const interesting =
      name.startsWith('http_req') ||
      name === 'checks' ||
      name.startsWith('rate_limited') ||
      name === 'api_latency' ||
      name === 'recovery_latency';
    if (interesting) metrics[name] = metric.values;

    for (const [expr, result] of Object.entries(metric.thresholds || {})) {
      thresholds.push({ metric: name, threshold: expr, ok: result.ok });
    }
  }

  const summary = {
    scenario,
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    healthPath: HEALTH_PATH,
    configuredThresholds: SCENARIO_THRESHOLDS[scenario],
    thresholds,
    allThresholdsPassed: thresholds.every((t) => t.ok),
    metrics,
  };

  const json = JSON.stringify(summary, null, 2);
  return {
    stdout: json,
    [`${scenario}-results.json`]: json,
  };
}

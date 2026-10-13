"""Local stub of the CreditMate AI read API, for validating the k6 suite without a backend.

Serves the same paths as the real backend (credit_mate_ai/urls.py and
credit_cards/api/urls.py), with response shapes taken from the serializers and
views. It does not implement filtering or ranking: results are fixed slices of
the fixture cards, so this checks routing, parameter handling, and script logic
rather than search semantics. It does not throttle, so 429 paths are not exercised.

Usage:
    python3 stub/server.py --port 4123
"""

import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

API = "/api/v1/credit-cards"

CATEGORIES = [
    {"slug": "travel", "name": "Travel"},
    {"slug": "cashback", "name": "Cashback"},
    {"slug": "premium", "name": "Premium"},
    {"slug": "student", "name": "Student"},
    {"slug": "business", "name": "Business"},
    {"slug": "no-annual-fee", "name": "No Annual Fee"},
]

SORT_OPTIONS = [
    {"key": "relevance", "label": "Relevance", "description": "Best match first (default with search query)"},
    {"key": "annual_fee", "label": "Annual Fee (Low to High)", "description": "Sort by annual fee ascending"},
    {"key": "-annual_fee", "label": "Annual Fee (High to Low)", "description": "Sort by annual fee descending"},
    {"key": "name", "label": "Name (A-Z)", "description": "Sort by card name ascending"},
]

BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak"]


def make_cards(count=25):
    cards = []
    for i in range(1, count + 1):
        bank = BANKS[i % len(BANKS)]
        fee = (i % 5) * 1000
        cards.append({
            "id": i,
            "bank": {"id": BANKS.index(bank) + 1, "name": bank},
            "bank_id": BANKS.index(bank) + 1,
            "bank_name": bank,
            "name": f"{bank} Card {i}",
            "annual_fee": fee,
            "interest_rate_apr": 18.0 + i % 10,
            "lounge_access_international": "" if i % 3 else "4 visits/yr",
            "lounge_access_domestic": "" if i % 4 else "8 visits/yr",
            "has_lounge_access": i % 3 != 0,
            "has_annual_fee": fee > 0,
        })
    return cards


CARDS = make_cards()
CARDS_BY_ID = {str(c["id"]): c for c in CARDS}


def page_of(items, params):
    page = max(int(params.get("page", ["1"])[0] or 1), 1)
    page_size = min(max(int(params.get("page_size", ["20"])[0] or 20), 1), 100)
    start = (page - 1) * page_size
    return items[start:start + page_size], len(items)


def paginated(items, params):
    results, count = page_of(items, params)
    return {"count": count, "next": None, "previous": None, "results": results}


def typeahead(params):
    q = params.get("q", [""])[0][:100].strip()
    if len(q) < 2:
        return {
            "match_policy": {"minimum_characters": 2, "result_limit": 5, "active": False},
            "highlight": {"terms": [], "scope": None, "strategy": None},
            "suggestions": [],
        }
    matches = [c for c in CARDS if q.lower() in c["name"].lower()][:5]
    return {
        "match_policy": {"minimum_characters": 2, "result_limit": 5, "active": True},
        "highlight": {"terms": [q], "scope": "cards", "strategy": "contains"},
        "suggestions": [{"type": "card", "id": c["id"], "label": c["name"]} for c in matches],
    }


def advanced_search(params):
    search = params.get("search", [""])[0].strip()
    results, total = page_of(CARDS, params)
    return {
        "query": search,
        "total": total,
        "page": 1,
        "page_size": len(results),
        "results": results,
        "facets": {},
        "took": 0,
        "source": "database",
        "cached": False,
        "sort_options": SORT_OPTIONS,
        "categories": CATEGORIES,
        "normalized_query": normalize(params),
    }


def normalize(params):
    """Mirror the scalar/boolean/multi-value handling of normalize_query_params."""
    out = {}
    for key in ("search", "bank_name", "annual_fee_min", "annual_fee_max", "ordering", "page", "page_size"):
        value = params.get(key, [""])[0].strip()
        if value:
            out[key] = value
    for key in ("has_lounge_access", "has_annual_fee", "no_annual_fee", "has_fee_waiver"):
        if params.get(key, [""])[0].lower() in ("true", "1", "yes", "on"):
            out[key] = "true"
    if "categories" in params:
        flat = sorted({c.strip() for v in params["categories"] for c in v.split(",") if c.strip()})
        if flat:
            out["categories"] = ",".join(flat)
    return out


DETAIL_RE = re.compile(rf"^{API}/(\d+)/$")


class Handler(BaseHTTPRequestHandler):
    server_version = "creditmate-stub/1.0"

    def log_message(self, fmt, *args):  # keep the k6 run output clean
        return

    def _send(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _route(self):
        parts = urlsplit(self.path)
        path = parts.path
        params = parse_qs(parts.query, keep_blank_values=True)

        if path == "/health/":
            return 200, {"status": "healthy", "message": "Credit Mate AI Backend is running"}
        if path == f"{API}/":
            return 200, paginated(CARDS, params)
        if path == f"{API}/search-suggestions/":
            # The real view ignores q; kept identical here.
            return 200, {
                "annual_fee_ranges": [{"label": "Free", "filter": "annual_fee=0"}],
                "benefits": [{"label": "No Annual Fee", "filter": "no_annual_fee=true"}],
                "popular_banks": BANKS,
            }
        if path == f"{API}/typeahead/":
            return 200, typeahead(params)
        if path == f"{API}/advanced-search/":
            return 200, advanced_search(params)
        if path == f"{API}/advanced-search/sort-options/":
            return 200, {"sort_options": SORT_OPTIONS}
        if path == f"{API}/advanced-search/categories/":
            return 200, {"categories": CATEGORIES}
        if path == f"{API}/advanced-search/normalize/":
            return 200, {"normalized_query": normalize(params), "query_hash": "stub", "canonical_string": ""}

        match = DETAIL_RE.match(path)
        if match:
            card = CARDS_BY_ID.get(match.group(1))
            if card is None:
                return 404, {"detail": "Not found."}
            return 200, card

        return 404, {"detail": "Not found."}

    def do_GET(self):
        status, body = self._route()
        self._send(status, body)

    do_HEAD = do_GET

    def _method_not_allowed(self):
        self._send(405, {"detail": f'Method "{self.command}" not allowed.'})

    do_POST = do_PUT = do_PATCH = do_DELETE = _method_not_allowed


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"stub listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

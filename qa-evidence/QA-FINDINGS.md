# CreditMate AI — QA Findings Report

**Date:** 2026-10-19
**Tester:** QA pass (headless browser + API)
**Scope:** `creditmate-ai-fe` (React 18 / CRA 5 / TS) + `creditmate-ai-be` (Django 5.2 / DRF) + data
**Repos:** `avoid-ashraful/creditmate-ai` (parent), `-ai-fe`, `-ai-be`

---

## 1. Environment used

| Piece | Setup |
|---|---|
| Backend | `DATABASE_URL=postgresql:///creditmate_local CACHE_BACKEND=locmem DEBUG=True uv run python manage.py runserver` |
| Frontend | Production build served statically: `npm run build` + `npx serve -s build -l 3000` pointed at the QA backend |
| Browser | Playwright Chromium **headless** (desktop 1440×900, mobile 390×844) |
| Data | 65 banks, 135 cards (105 verified/public, 30 draft) |

> Runtime headless flags required on this host: `--no-sandbox --disable-dev-shm-usage --no-zygote --single-process --disable-gpu`.
> Raw evidence: `qa-artifacts/screenshots/*.png`, `qa-artifacts/flow-*.json`, `qa-artifacts/crawl-desktop.json`, `qa-artifacts/crawl-mobile.json`, `qa-artifacts/a11y.json`.

---

## 2. Findings

Severity: **P0** blocker / **P1** high / **P2** medium / **P3** low.

### 2.1 Frontend (user-facing)

| ID | Sev | Finding |
|---|---|---|
| QA-FE-01 | P1 | **Mobile header nav overflows the viewport; most links unreachable.** At 390px the `.main-nav ul` is 748px wide inside a 358px container with `overflow: visible` and there is **no hamburger menu**. "Quiz / Compare / Calculator / Guides / Glossary / About / Bengali / Dark / Log in / Register" sit off-screen. Evidence: `mobile-top-home.png`, `crawl-mobile.json`. |
| QA-FE-02 | P1 | **Home category cards render body text at 20px** because `.hero-section p { font-size: 1.25rem }` (HomePage.css:44) also matches `.category-description` inside the hero. Result: 167px-wide cards become ~487px tall, the 5-column grid overflows its 900px container, and the last column is clipped. Evidence: `bug-category-grid.png`, `home-desktop.png`. Fix: scope the hero paragraph rule (e.g. `.hero-content > p`) or set an explicit `font-size` on `.category-description`. |
| QA-FE-03 | P1 | **Advanced Search pagination never leaves page 1.** `handlePageChange` → `handleFilterChange` which unconditionally does `setUiState(prev => ({ ...prev, ...updates, page: 1 }))` (AdvancedSearchPage.tsx:315–317, 351–356). Clicking "Next ›" leaves the URL unchanged and still shows "Page 1 of 6" with the same first card. Evidence: `flow-search.json`, `flow-search-pagination.png`. |
| QA-FE-04 | P1 | **"Copy share link" for a saved collection always fails.** `SavedPage.copyCollectionLink` reads/uses `share_token`, but the collection API returns `slug` (and the public route is `/saved/shared/collections/<slug>/`). The UI shows *"Something went wrong. Please try again."* — collections can never be shared. Evidence: `flow-collection-share.png`; API: create+PUBLISH return `slug` only. |
| QA-FE-05 | P1 | **Customer Reviews die for anonymous users after 5 card views.** The public review list is throttled 5/hour (see QA-BE-01); after 5 requests the section shows *"We could not reach the service. Please try again."* with a 429 toast. Evidence: `card-detail-desktop.png`. |
| QA-FE-06 | P2 | **Quiz accepts skipping every question** and still returns 3 "recommendations" (match scores). `handleNext` has no validation (RecommendationQuiz.tsx:142) and Next is always enabled. Evidence: `flow-quiz.json` (`noAnswerResult.reachedResults=1`). |
| QA-FE-07 | P2 | **"Share This Comparison" is misused as a label in three places**: the card "View details" link (CardListItem.tsx:168), the "view full details" link in the popup (CardDetailsPopup.tsx:242), the in-compare toggle state (CardListItem.tsx:180, CardDetailsPopup.tsx:249), and the comparison-bar CTA that navigates to Compare (ComparisonBar.tsx:103). Users see "Share This Comparison" where they expect "View details" / "Added to comparison" / "Compare now". Evidence: `flow-popup.png`, `flow-comparebar.png`. |
| QA-FE-08 | P2 | **"Save search" button is a no-op** (TODO at AdvancedSearchPage.tsx:1265). Clicking it changes nothing and shows no feedback. Evidence: `flow-search.json` (`saveSearchUrlChanged=false`, no toast). |
| QA-FE-09 | P2 | **Bengali i18n gaps.** Advanced-search category chips stay English (Travel/Cashback/Premium/Student/Business/No Annual Fee), the calculator mixes "BDT / month", and the quiz progress label is *"ধাপ 1 of 5"* (Bengali + English "of"). Evidence: `i18n-bengali-search-filters.png`, `i18n-bengali-quiz-progress.png`, `flow-bengali-*.png`. |
| QA-FE-10 | P3 | **Network failure on a card page is labelled "Card Not Found"** (CardDetailPage.tsx), which misleads users into thinking the card was removed. Evidence: `flow-error-card.png`. |
| QA-FE-11 | P3 | **No card artwork anywhere.** The backend exposes no `images` field, so `card.images` is always empty; the card-detail left column and listings have a blank/empty visual area. Evidence: `card-detail-desktop.png`. |
| QA-FE-12 | P3 | **Accessibility (axe): `link-in-text-block` (serious)** on `/` (7 nodes) and `/category/*` (5 nodes) — links ("Share This Comparison") rely on colour alone. Evidence: `a11y.json`. |
| QA-FE-13 | P3 | **Theme toggle always reads "Dark"** even when dark mode is active (icon changes to ☀️, label does not). Evidence: `flow-dark-home2.png`, `flow-dark-errors.json`. |
| QA-FE-14 | P3 | **Collection detail requires typing a raw numeric card ID** ("Add card ID / Create"), which no user can know. A card picker/autocomplete is expected. Evidence: `flow-collection-page.png`. |
| QA-FE-16 | P1 | **Advanced Search results are capped at the first 10 cards; "Load more" does not work.** The header says "Showing 20 of 105 cards" but only 10 render. Clicking the CardList "Load more cards (10 remaining)" flashes 20 items for one frame, then remounts and snaps back to 10 (its internal `displayLimit` state is reset), firing 4 duplicate `advanced-search` requests. The same control works on Home (10→20) and `/category/*` (10→20). The page also has three overlapping pagination affordances (CardList internal load-more, page-level load-more, Previous/Next). Evidence: `flow-advsearch-controls.json`, `fe-16-advsearch-controls.png`. |
| QA-FE-15 | P3 | **Local `node_modules` does not match `package.json`/`package-lock.json`** (msw installed 3.0.3 vs lock 1.3.5; @testing-library/react 13.4.0 vs 16.3.3; user-event 13.5.0 vs 14.5.2). This makes `npx tsc --noEmit` fail on `msw` types, makes Jest fail (26/78 suites), and causes the CRA dev-server "Compiled with problems" overlay. A fresh `npm ci` is required. Evidence: `findings-frontend-audit.md`, build log. |

### 2.2 Backend / API

| ID | Sev | Finding |
|---|---|---|
| QA-BE-01 | P1 | **Public review list is throttled 5/hour for anonymous visitors.** `PublicReviewListCreateView` sets `throttle_classes=[ReviewUserThrottle]` with scope `review_write` (5/hour). DRF's `UserRateThrottle` keys anonymous requests by IP, so **5 GETs succeed and the 6th returns 429 with Retry-After ≈ 1 hour**, for the whole Customer Reviews feature. Reproduced: `GET /api/v1/reviews/?card=1` ×6 → `200,200,200,200,200,429`. |
| QA-BE-02 | P1 | **Draft (unpublished) cards leak publicly through shared comparisons.** A logged-in user can create a comparison containing a `verification_status='draft'` card (e.g. id 10, "Visa/Mastercard Gold Credit Card"), publish it, and the **anonymous** endpoint `/api/v1/saved/shared/<token>/` returns the draft card's full record (fees, lounge, rewards, source URLs). Detail (`/credit-cards/10/`) correctly 404s, so the leak is only via saved/shared payloads. |
| QA-BE-03 | P1 | **Non-integer query params return HTTP 500 with a full HTML Django debug traceback** (DEBUG=True): `/api/v1/credit-cards/?ids=abc`, `/api/v1/credit-cards/?bank_ids=abc`, `/api/v1/reviews/?card=abc`. Should be `400` with JSON field errors. |
| QA-BE-04 | P2 | **Cross-user logout.** Any authenticated user can blacklist another user's refresh token: user C POSTs `/auth/logout/` with user A's refresh token and A's token becomes blacklisted (`{"refresh":["Token is blacklisted"]}`). Logout must only accept the caller's own token. |
| QA-BE-05 | P2 | **Password change does not invalidate existing access tokens.** After `POST /auth/change-password/`, the previously issued access token still authenticates `/auth/me/` (200) for the rest of its 15-minute lifetime; only the refresh token is blacklisted. |
| QA-BE-06 | P2 | **`has_lounge_access` false positives (known QA #15 area).** Cards 5 ("VISA Cashback", lounge text "None") and 11 ("Visa/Mastercard Gold Flexi", "None … not applicable") report `has_lounge_access=true` and appear under the lounge filter / Travel category. |
| QA-BE-07 | P2 | **Documented advanced-search filters are silently ignored** (return the unfiltered 105): `bank`, `is_active=false`, `has_lounge_access=false`, `annual_fee`, `q=`. Only `bank_ids`, `search`, and the positive boolean/range params work. |
| QA-BE-08 | P2 | **Travel ordering is not by entitlement.** The category sorts by `-lounge_access_international`, a free-text field, so "Up to 6 complimentary…" ranks above "Unlimited free…" and "UCB…" beats numeric counts. The description promises "sorted by international lounge entitlement". |
| QA-BE-09 | P3 | **`/api/search/status/` returns HTTP 500** with an HTML traceback (`SearchUnavailable`) when Elasticsearch is down, and **`/api/search/` returns 503**; a health/status endpoint should return structured JSON. |
| QA-BE-10 | P3 | **Data completeness gaps:** 71/105 public cards have no `apply_url` (users only get "View fee schedule"); 98/105 have no `reward_point_value_bdt`; 89/105 have no `min_monthly_income`; 30 draft cards are never surfaced. |
| QA-BE-11 | P3 | **415 on bodyless DELETE/POST** through the Django dev server (`wsgiref` injects `CONTENT_TYPE=text/plain`). Environment-amplified but affects local client testing. |

### 2.3 Checked and NOT bugs (disproven)

- Bank `credit_card_count` inflation (a subagent claim of 480) — **not reproducible**; counts sum to 105 and match the list per bank.
- Password-reset user enumeration — **not reproducible**; both existing and unknown emails return the same generic 200 message.
- `tsc --noEmit` parse errors in `node_modules/msw` — caused by the `node_modules` drift (QA-FE-15), not by source code.
- Draft cards in list/detail/typeahead — correctly excluded/404.
- Protected routes (`/saved`, `/account`, `/alerts`) correctly redirect to `/login`.
- Home "9 Partner Banks" — correct (9 banks actually hold the 105 cards).

---

## 3. Suggested improvements

1. **Mobile navigation:** add a hamburger/drawer or a horizontally scrollable nav; never set `overflow: visible` on a container narrower than its content.
2. **CSS scoping:** give hero copy a class instead of the bare `.hero-section p` selector; add a token for category description size.
3. **Pagination:** special-case page changes in `handleFilterChange` (or add a dedicated `setPage`) so filters reset to page 1 but pagination does not.
4. **Sharing contract:** either expose `share_token` on `CollectionSerializer` or switch the frontend to `slug` **and** route to `/shared/collections/:slug`; add an integration test for both share types.
5. **Throttling:** move reads off the `review_write` scope (user-scoped 5/hour only on POST); consider a higher anon read budget (the global 100/min also 429s during normal browsing).
6. **Persist comparison selection** (localStorage/URL) from Home so `Compare` is not empty on a fresh navigation.
7. **Quiz:** require an answer per step (disable Next or show validation) and auto-advance after selection.
8. **Copy:** add dedicated keys (`cardViewDetails`, `comparisonAdded`, `comparisonCompareNow`) instead of reusing `comparisonFooterShare`.
9. **Save search:** implement it or hide/disable the button with a tooltip.
10. **Bengali:** finish translating category facet names and remove mixed-language tokens ("of", "BDT / month"); use Bengali numerals consistently.
11. **Card imagery:** add an `images` field or a designed placeholder so the detail layout doesn't look broken.
12. **Accessibility:** underline in-content links (or otherwise distinguish them from text) to clear `link-in-text-block`.
13. **Data quality:** backfill `apply_url`, lounge entitlement as a numeric/structured field (so sorting/filtering is real), `reward_point_value_bdt`, and `min_monthly_income`; add validation to prevent `has_lounge_access` false positives.
14. **Security:** reject `500`s on bad input (use serializer validation), validate refresh-token ownership on logout, and invalidate access tokens on password change (token version/`last_login` claim).

---

## 4. Evidence index

| Area | File(s) |
|---|---|
| Category layout | `bug-category-grid.png`, `home-desktop.png` |
| Mobile nav | `mobile-top-home.png`, `crawl-mobile.json` |
| Search pagination | `flow-search-pagination.png`, `flow-search.json` |
| Collection share | `flow-collection-share.png`, `flow-collection.json` |
| Review throttle | `card-detail-desktop.png` + curl transcript (§2.2 QA-BE-01) |
| Quiz | `flow-quiz.json`, `flow-quiz-results.png` |
| Compare bar label | `flow-comparebar.png`, `flow-popup.png`, `flow-comparepage.png` |
| i18n | `i18n-bengali-search-filters.png`, `i18n-bengali-quiz-progress.png`, `flow-bengali-home.png` |
| Error states | `flow-error-home.png`, `flow-error-search.png`, `flow-error-card.png` |
| Dark mode | `flow-dark-home2.png`, `flow-dark-search2.png` |
| A11y | `a11y.json` |
| Route crawl | `crawl-desktop.json`, `crawl-mobile.json` |
| Deep audits | `findings-frontend-audit.md`, `findings-backend.md` |

---

## 5. GitHub issues filed

All issues were filed in **`avoid-ashraful/creditmate-ai`** (labels: `bug`, `priority:P1…P3`, `accessibility`) with screenshots embedded from the `qa/evidence-2026-10-19` branch.

| Issue | Finding |
|---|---|
| [#87](https://github.com/avoid-ashraful/creditmate-ai/issues/87) | [FE][P1] Mobile header navigation overflows viewport with no menu (QA-FE-01) |
| [#88](https://github.com/avoid-ashraful/creditmate-ai/issues/88) | [FE][P1] Home category cards render 20px body text, breaking the grid (QA-FE-02) |
| [#89](https://github.com/avoid-ashraful/creditmate-ai/issues/89) | [FE][P1] Advanced Search pagination stuck on page 1 (QA-FE-03) |
| [#90](https://github.com/avoid-ashraful/creditmate-ai/issues/90) | [FE][P1] Saved collection "Copy share link" always fails (QA-FE-04) |
| [#91](https://github.com/avoid-ashraful/creditmate-ai/issues/91) | [FE][P1] Customer Reviews fail for anonymous users after 5 views (QA-FE-05) |
| [#92](https://github.com/avoid-ashraful/creditmate-ai/issues/92) | [FE][P2] Quiz allows skipping every question (QA-FE-06) |
| [#93](https://github.com/avoid-ashraful/creditmate-ai/issues/93) | [FE][P2] "Share This Comparison" label reused incorrectly (QA-FE-07) |
| [#94](https://github.com/avoid-ashraful/creditmate-ai/issues/94) | [FE][P2] "Save search" button is a no-op (QA-FE-08) |
| [#95](https://github.com/avoid-ashraful/creditmate-ai/issues/95) | [FE][P2] Bengali translation gaps (QA-FE-09) |
| [#96](https://github.com/avoid-ashraful/creditmate-ai/issues/96) | [FE][P3] Network error labelled "Card Not Found" (QA-FE-10) |
| [#97](https://github.com/avoid-ashraful/creditmate-ai/issues/97) | [FE][P3] No card artwork renders anywhere (QA-FE-11) |
| [#98](https://github.com/avoid-ashraful/creditmate-ai/issues/98) | [FE][P3] a11y: `link-in-text-block` on home/category (QA-FE-12) |
| [#99](https://github.com/avoid-ashraful/creditmate-ai/issues/99) | [FE][P3] `node_modules`/lock drift breaks tsc, Jest, dev server (QA-FE-15) |
| [#108](https://github.com/avoid-ashraful/creditmate-ai/issues/108) | [FE][P1] Advanced Search results capped at 10; "Load more" broken (QA-FE-16) |
| [#100](https://github.com/avoid-ashraful/creditmate-ai/issues/100) | [BE][P1] Public review list throttled 5/hour for anonymous users (QA-BE-01) |
| [#101](https://github.com/avoid-ashraful/creditmate-ai/issues/101) | [BE][P1] Non-integer query params → HTTP 500 HTML traceback (QA-BE-03) |
| [#102](https://github.com/avoid-ashraful/creditmate-ai/issues/102) | [BE][P1] Draft cards leak via public shared comparisons (QA-BE-02) |
| [#103](https://github.com/avoid-ashraful/creditmate-ai/issues/103) | [BE][P2] Cross-user logout can blacklist another user's refresh token (QA-BE-04) |
| [#104](https://github.com/avoid-ashraful/creditmate-ai/issues/104) | [BE][P2] Password change does not invalidate access tokens (QA-BE-05) |
| [#105](https://github.com/avoid-ashraful/creditmate-ai/issues/105) | [BE][P2] `has_lounge_access` false positives (QA-BE-06) |
| [#106](https://github.com/avoid-ashraful/creditmate-ai/issues/106) | [BE][P2] Advanced-search filters ignored; travel ordering lexicographic (QA-BE-07) |
| [#107](https://github.com/avoid-ashraful/creditmate-ai/issues/107) | [BE][P3] `/api/search/status` 500s; catalogue data gaps (QA-BE-09/10) |

## 6. Verified working (positive coverage)

- Search: `brac` → 10 cards; nonsense → "Category not found" empty state; autocomplete (`visa`, `city bank`) returns grouped suggestions.
- Filters/sort on Advanced Search: sort by annual fee works (first card BDT 0); positive filters (bank, lounge, fee, network, Islamic, dual-currency) return correct counts.
- Home "Load More": 10 → 20 cards. Compare selection limit (4) enforced with message.
- Comparison page: `?ids=` loads cards; sharing works; saving requires login and redirects to `/login` correctly.
- Calculator: 5 spend inputs, ranked results, negative-input validation.
- Auth: register → login, protected-route redirects, account page, email-verification notice; validation errors are safe and non-enumerating (login wrong/nonexistent both show "Invalid email or password."; register mismatch/weak/no-terms/duplicate all show "Please check the highlighted fields."; forgot-password and reset always show the generic "If an account exists…" message).
- Advanced Search result set is correct (search "brac" → 10), page-size selector works (Showing 20 → 50), but the list itself is capped (see QA-FE-16).
- Account page: "Resend verification email" and data/delete sections render; alerts "Save preferences" confirms "Preferences saved".
- Guides: index lists 28 guides; an article renders 9 sections + 17 related links. Compare page: removing a card updates `?ids=` correctly (`ids=1,2,3` → `ids=2,3`).
- Watch/alerts: watch toggle persists and appears on `/alerts` with preferences.
- Report an issue: dialog validates and shows a success confirmation.
- Glossary search (53 → 1 term for "lounge") and Guides index (28 links).
- Dark mode toggles, persists to `localStorage`, applies `<html class="dark">`.
- 404 route and invalid share-token state render friendly messages.
- No uncaught JS errors on the routes exercised (aside from the documented 500/429 API responses).

---

## 7. Method & limitations

- Backend and frontend were run locally; the frontend was exercised through a **production** build (the CRA dev server displayed a TS-warning overlay caused by the stale `node_modules`).
- Playwright Chromium on this host only runs with `--single-process`, so page/context teardown is unsupported; scripts reuse one page and navigate sequentially.
- Some cross-cutting checks (Elasticsearch-backed search, Sentry, email) are not configured locally and were evaluated only for graceful fallback.
- Findings marked "reproduced" were confirmed with concrete requests/UI actions during this pass; §2.3 lists claims that did **not** reproduce.

# CreditMate AI - Detailed Task Breakdown for Sub-Agents

This file contains specific, actionable tasks with acceptance criteria for each of the 10 workstreams. Each task can be assigned to a sub-agent for parallel execution.

---

## STREAM 1: Backend API & Infrastructure
**Lead**: Backend Engineer | **Dependencies**: None (starts first)

### Task 1.1: Fix Database Schema - Nullable Critical Fields [P0, 2 days]
**Files**: `creditmate-ai-be/credit_cards/models.py`, migrations
**Acceptance Criteria**:
- [ ] `annual_fee` field: `null=True, blank=True` (remove default=0)
- [ ] `interest_rate_apr` field: `null=True, blank=True` (remove default=0)
- [ ] Migration created and applied successfully
- [ ] Existing data preserved (0 → NULL for truly missing)
- [ ] Validators updated to handle None values

### Task 1.2: Connect Frontend to Backend API [P0, 3 days]
**Files**: `creditmate-ai-fe/src/services/api.ts`, `creditmate-ai-fe/src/config/env.ts`
**Acceptance Criteria**:
- [ ] FE `apiService` calls real Django endpoints (not dummy data)
- [ ] Environment config for API_BASE_URL (dev/staging/prod)
- [ ] All HomePage, ComparisonPage, FilterPanel work with real data
- [ ] Error handling for API failures (toast notifications)
- [ ] Loading states during fetch

### Task 1.3: Redis Caching Layer [P1, 3 days]
**Files**: `creditmate-ai-be/credit_mate_ai/settings.py`, new `cache.py`, views
**Acceptance Criteria**:
- [ ] Redis configured (docker-compose + settings)
- [ ] Cache credit card list (TTL: 5 min)
- [ ] Cache filter results (TTL: 2 min)
- [ ] Cache search suggestions (TTL: 10 min)
- [ ] Cache invalidation on data update (signal/post_save)

### Task 1.4: API Rate Limiting & Request Validation [P1, 2 days]
**Files**: `creditmate-ai-be/credit_mate_ai/settings.py`, custom throttle classes
**Acceptance Criteria**:
- [ ] Anonymous: 100 req/min, Authenticated: 1000 req/min
- [ ] Burst protection (10 req/sec)
- [ ] Request validation middleware (max payload, content-type)
- [ ] Proper 429 responses with `Retry-After` header

### Task 1.5: Error Tracking (Sentry) Integration [P1, 1 day]
**Files**: `creditmate-ai-be/credit_mate_ai/settings.py`, `wsgi.py`
**Acceptance Criteria**:
- [ ] Sentry DSN configured via env
- [ ] Errors captured with context (user, request, tags)
- [ ] Performance monitoring enabled
- [ ] Release tracking on deploy

---

## STREAM 2: Data Pipeline & Quality
**Lead**: Data Engineer | **Dependencies**: Stream 1.1 (DB schema)

### Task 2.1: Deploy Improved Crawler with Quality Scoring [P0, 4 days]
**Files**: Per `creditmate-ai-be/docs/improvements.md` (Phases 1-3)
**Acceptance Criteria**:
- [ ] Multi-pass LLM extraction implemented
- [ ] Bank-specific prompt templates (5+ banks)
- [ ] Extraction confidence scoring (0-1)
- [ ] Quality fields on `CrawledContent` model
- [ ] Daily cron job runs for all active banks

### Task 2.2: Data Quality Dashboard [P0, 3 days]
**Files**: New Django app `quality_dashboard/`, Grafana/Metabase
**Acceptance Criteria**:
- [ ] Per-bank extraction success rate
- [ ] Missing critical fields count (annual_fee, interest_rate)
- [ ] Average confidence score trend (7d, 30d)
- [ ] OCR vs text extraction comparison
- [ ] Alert on confidence < 0.5 or success rate < 70%

### Task 2.3: Manual Review Queue [P1, 3 days]
**Files**: `ReviewQueue` model, admin, notification service
**Acceptance Criteria**:
- [ ] Auto-enqueue low-confidence extractions
- [ ] Admin UI: filter by bank, priority, status
- [ ] Side-by-side: extracted vs source content
- [ ] Approve/Reject/Edit actions
- [ ] Email/Slack notification for high-priority

### Task 2.4: Multi-Source Validation [P1, 4 days]
**Files**: New validation service, enhanced crawler
**Acceptance Criteria**:
- [ ] Cross-reference: bank website + PDF + user submissions
- [ ] Conflict detection (different values for same field)
- [ ] Confidence boost for multi-source agreement
- [ ] Flag for manual review on conflicts

### Task 2.5: Historical Tracking & Change Detection [P2, 3 days]
**Files**: New `CreditCardHistory` model, comparison logic
**Acceptance Criteria**:
- [ ] Snapshot on every field change
- [ ] "Fee changed from X to Y on DATE" in UI
- [ ] API endpoint: `/cards/{id}/history`
- [ ] Webhook/event on significant changes

---

## STREAM 3: Core Frontend Features
**Lead**: Frontend Engineer | **Dependencies**: Stream 1.2 (API connection)

### Task 3.1: Category-Based Browsing [P1, 2 days]
**Files**: `src/pages/CategoryPage.tsx`, `src/components/CategoryCard.tsx`, routing
**Acceptance Criteria**:
- [ ] Categories: Travel, Cashback, Premium, Student, Business, No Annual Fee
- [ ] `/category/travel` → filtered list with category badge
- [ ] Category cards on homepage (hero section)
- [ ] SEO-friendly titles/meta per category

### Task 3.2: Smart Recommendation Quiz [P0, 4 days]
**Files**: `src/pages/RecommendationQuiz.tsx`, `src/components/QuizStep.tsx`, logic
**Acceptance Criteria**:
- [ ] 5-step quiz: spend/month, primary use, travel freq, fee tolerance, card tier
- [ ] Algorithm: weighted scoring → top 3 matches
- [ ] Results page with "Why this card" explanations
- [ ] "Retake quiz" and "See all cards" CTAs
- [ ] Shareable result link (`?quiz_result=...`)

### Task 3.3: Annual Fee vs Rewards Calculator [P0, 3 days]
**Files**: `src/components/RewardsCalculator.tsx`, `src/pages/CalculatorPage.tsx`
**Acceptance Criteria**:
- [ ] Inputs: monthly spend, categories (dining, travel, groceries, fuel, other)
- [ ] Output: net value/year per card (rewards - fees)
- [ ] Break-even analysis: "Spend 25k/mo to offset fee"
- [ ] Top 5 cards ranked by net value
- [ ] Export to comparison

### Task 3.4: Card Detail Deep-Dive Pages [P0, 4 days]
**Files**: `src/pages/CardDetailPage.tsx`, dynamic routing `/card/:bankSlug/:cardSlug`
**Acceptance Criteria**:
- [ ] SEO: meta tags, JSON-LD schema, OG images
- [ ] Full specs table (all model fields)
- [ ] Pros/Cons summary (auto-generated from data)
- [ ] Fee waiver calculator (spend threshold)
- [ ] Similar cards sidebar
- [ ] "Apply Now" CTA (track clicks)
- [ ] User reviews section (placeholder for Stream 7)

### Task 3.5: "Why This Card Wins" AI Narratives [P1, 3 days]
**Files**: `src/utils/comparisonNarrative.ts`, integration in ComparisonTable
**Acceptance Criteria**:
- [ ] Rule-based (not LLM) for reliability
- [ ] Templates per comparison pattern
- [ ] Example: "Choose EBL Platinum if you value lounge access (6 intl vs 2)..."
- [ ] Shows on comparison page + detail page

### Task 3.6: Mobile-First Comparison Table [P0, 3 days]
**Files**: `src/components/CardComparisonTable.tsx`, `src/styles/ComparisonPage.css`
**Acceptance Criteria**:
- [ ] <768px: Card stack layout (vertical cards, swipeable)
- [ ] Sticky feature column on horizontal scroll
- [ ] Collapsible sections for long comparisons
- [ ] Touch-friendly remove buttons
- [ ] Performance: virtualized if >4 cards

---

## STREAM 4: Design System & Accessibility
**Lead**: Design Engineer | **Dependencies**: None (can start immediately)

### Task 4.1: Design Token System [P0, 3 days]
**Files**: `design-tokens/` (JSON), `src/styles/tokens.ts`, Style Dictionary config
**Acceptance Criteria**:
- [ ] Colors: semantic (primary, secondary, success, warning, error, backgrounds)
- [ ] Spacing: 4px base scale (xs, sm, md, lg, xl, 2xl, 3xl)
- [ ] Typography: font families, sizes, weights, line heights
- [ ] Border radius, shadows, transitions
- [ ] Build outputs: CSS vars, TS constants, Figma tokens

### Task 4.2: Storybook Component Library [P1, 4 days]
**Files**: `.storybook/`, `src/components/**/*.stories.tsx`
**Acceptance Criteria**:
- [ ] 20+ documented components (Button, Card, Input, Table, Modal, etc.)
- [ ] Controls for all props, knobs for states
- [ ] Accessibility addon (a11y checks)
- [ ] Viewport addon (mobile/tablet/desktop)
- [ ] Published to Chromatic/Netlify

### Task 4.3: WCAG 2.1 AA Compliance [P1, 4 days]
**Files**: All components, global styles, test setup
**Acceptance Criteria**:
- [ ] Semantic HTML5 (header, main, nav, section, article)
- [ ] ARIA labels/roles where needed
- [ ] Focus visible on all interactive elements
- [ ] Color contrast ≥ 4.5:1 (text), 3:1 (UI)
- [ ] Keyboard navigation: tab order, skip links, escape to close modals
- [ ] Screen reader tested (NVDA/VoiceOver)
- [ ] axe-core in CI (zero violations)

### Task 4.4: Dark Mode Support [P2, 3 days]
**Files**: `src/styles/theme.css`, `src/hooks/useTheme.ts`, components
**Acceptance Criteria**:
- [ ] CSS custom properties for all colors
- [ ] `prefers-color-scheme` detection
- [ ] Manual toggle (persisted in localStorage)
- [ ] No flash of wrong theme on load
- [ ] All components work in both modes

### Task 4.5: Micro-interactions & Motion [P2, 2 days]
**Files**: `src/animations/`, Framer Motion variants
**Acceptance Criteria**:
- [ ] Page transitions (fade + slide)
- [ ] Card hover/tap feedback
- [ ] Loading skeletons (shimmer)
- [ ] Staggered list entrance
- [ ] Respect `prefers-reduced-motion`

---

## STREAM 5: Testing & Quality Assurance
**Lead**: QA Engineer | **Dependencies**: Stream 1.2 (API), Stream 3.1 (features)

### Task 5.1: Fix HomePage Test (Mock API) [P0, 1 day]
**Files**: `src/pages/HomePage.test.tsx`, `src/__mocks__/api.ts` (MSW)
**Acceptance Criteria**:
- [ ] Test passes without backend running
- [ ] MSW handlers for `/banks/`, `/credit-cards/`, `/search-suggestions/`
- [ ] Test covers: load, filter, search, select, compare flow
- [ ] No console errors/warnings

### Task 5.2: Playwright E2E Tests (10 Critical Paths) [P0, 4 days]
**Files**: `e2e/` (new folder), `playwright.config.ts`
**Acceptance Criteria**:
1. Homepage loads → search "visa" → results appear
2. Filter by annual fee 0-2000 → correct cards shown
3. Select 3 cards → compare page → all data visible
4. Share comparison → link copied → open in new tab works
4. Card detail popup → image gallery navigation
5. Category page → filter → pagination
6. Recommendation quiz → results → share
7. Calculator → input spend → results ranked
8. Responsive: mobile/tablet/desktop breakpoints
9. Accessibility: tab navigation, ARIA
10. Error states: API down, no results, network error

### Task 5.3: Visual Regression Testing [P1, 2 days]
**Files**: Chromatic/Percy config, storybook stories
**Acceptance Criteria**:
- [ ] Baseline screenshots for all Storybook stories
- [ ] PR check: visual diff on component changes
- [ ] Threshold: 0.2% pixel difference
- [ ] Review workflow for intentional changes

### Task 5.4: API Contract Tests [P1, 2 days]
**Files**: `pact/` or `schemathesis/`, CI integration
**Acceptance Criteria**:
- [ ] Consumer-driven contracts (FE → BE)
- [ ] Verify BE responses match FE expectations
- [ ] Run in CI on both FE and BE changes
- [ ] Fail deploy on contract breach

### Task 5.5: Performance Budgets & Monitoring [P1, 2 days]
**Files**: `lighthouse-ci.config.js`, `src/reportWebVitals.ts`
**Acceptance Criteria**:
- [ ] LCP < 2.5s (mobile), < 1.5s (desktop)
- [ ] TBT < 200ms
- [ ] CLS < 0.1
- [ ] Bundle size < 200KB gzipped (initial)
- [ ] Web Vitals reported to PostHog
- [ ] Lighthouse CI in PR checks

### Task 5.6: Load Testing (k6) [P2, 2 days]
**Files**: `k6/` scripts, GitHub Action
**Acceptance Criteria**:
- [ ] 1000 VUs, ramp up 5 min, sustain 10 min
- [ ] API p95 < 200ms, p99 < 500ms
- [ ] Error rate < 0.1%
- [ ] Identify bottlenecks (DB, cache, CPU)
- [ ] Report with recommendations

---

## STREAM 6: Search & Discovery
**Lead**: Search Engineer | **Dependencies**: Stream 1.3 (Redis), Stream 2.1 (data)

### Task 6.1: Elasticsearch/Meilisearch Setup [P1, 2 days]
**Files**: Docker compose, `search/` service, sync script
**Acceptance Criteria**:
- [ ] Index: banks, credit_cards (with all filterable fields)
- [ ] Synonyms: "visa" = "credit card", "apr" = "interest rate"
- [ ] Bengali analyzer for local search
- [ ] Auto-sync on data changes (signal → queue → index)

### Task 6.2: Search Autocomplete & Facets [P1, 3 days]
**Files**: `src/components/SearchAutocomplete.tsx`, API endpoint
**Acceptance Criteria**:
- [ ] Type-ahead: min 2 chars, debounce 150ms
- [ ] Suggestions: card names, banks, categories
- [ ] Facet counts: "Travel (12)", "Cashback (8)", "No Fee (5)"
- [ ] Highlight matched terms in results
- [ ] "Did you mean?" for typos

### Task 6.3: Advanced Search Features [P2, 2 days]
**Files**: Search API, FE components
**Acceptance Criteria**:
- [ ] Filter by multiple categories (OR logic)
- [ ] Sort by: relevance, fee (low/high), APR (low/high), lounge access
- [ ] Save search / email alerts for new matches
- [ ] Search analytics (popular queries, zero results)

---

## STREAM 7: User Accounts & Engagement
**Lead**: Full-stack Engineer | **Dependencies**: Stream 1.4 (auth), Stream 3.4 (detail pages)

### Task 7.1: Authentication System [P1, 3 days]
**Files**: Django `auth/` app, FE `src/context/AuthContext.tsx`, pages
**Acceptance Criteria**:
- [ ] JWT access (15min) + refresh (7d) tokens
- [ ] Register/Login/Forgot password/Reset
- [ ] Google OAuth 2.0
- [ ] Email verification flow
- [ ] Protected routes (saved comparisons, alerts)
- [ ] HttpOnly secure cookies for tokens

### Task 7.2: Saved Comparisons & Collections [P1, 3 days]
**Files**: `SavedComparison` model, FE `src/pages/SavedComparisons.tsx`
**Acceptance Criteria**:
- [ ] Save current comparison (name, cards, notes)
- [ ] List view with edit/delete/duplicate
- [ ] Share saved comparison (public link)
- [ ] Max 20 saved per user (free tier)

### Task 7.3: Email Alerts & Notifications [P1, 3 days]
**Files**: `Notification` model, Celery tasks, FE preferences page
**Acceptance Criteria**:
- [ ] Preferences: fee changes, new cards, promos, weekly digest
- [ ] Template system (MJML/HTML + text)
- [ ] Unsubscribe link (one-click)
- [ ] Track open/click rates
- [ ] Respect frequency caps (max 1/day)

### Task 7.4: Community Reviews [P2, 4 days]
**Files**: `Review` model, FE `src/components/ReviewSection.tsx`
**Acceptance Criteria**:
- [ ] Verified users only (email verified + card holder?)
- [ ] Rating: overall, fees, rewards, service, app
- [ ] Pros/Cons (structured tags + free text)
- [ ] "Would recommend" boolean
- [ ] Moderation queue for spam/abuse
- [ ] Aggregate score on card detail page

---

## STREAM 8: DevOps & Deployment
**Lead**: DevOps Engineer | **Dependencies**: Stream 1 (backend ready)

### Task 8.1: GitHub Actions CI Pipeline [P1, 2 days]
**Files**: `.github/workflows/ci.yml`, `docker-compose.ci.yml`
**Acceptance Criteria**:
- [ ] On PR: lint → typecheck → unit tests → build
- [ ] On merge to main: build → push image → deploy staging
- [ ] Parallel jobs for FE and BE
- [ ] Cache node_modules, pip dependencies
- [ ] Artifacts: test reports, coverage, build logs

### Task 8.2: Staging Environment [P1, 2 days]
**Files**: `docker-compose.staging.yml`, Kubernetes manifests (staging)
**Acceptance Criteria**:
- [ ] Staging URL: staging.creditmate.ai
- [ ] Real data (subset), real APIs
- [ ] Auto-deploy on main merge
- [ ] Separate DB, Redis, ES from prod
- [ ] Smoke tests post-deploy

### Task 8.3: Production Kubernetes Configs [P1, 3 days]
**Files**: `k8s/` (base, overlays), Helm charts
**Acceptance Criteria**:
- [ ] Namespace separation (prod, staging)
- [ ] Deployments: FE (nginx), BE (gunicorn), Celery workers
- [ ] HPA: CPU > 70%, memory > 80%
- [ ] Ingress: TLS, rate limit, WAF rules
- [ ] Secrets: External Secrets Operator / SealedSecrets
- [ ] PodDisruptionBudgets, resource limits

### Task 8.4: Monitoring & Alerting [P1, 2 days]
**Files**: Grafana dashboards, Prometheus rules, Alertmanager
**Acceptance Criteria**:
- [ ] RED metrics: Rate, Errors, Duration (per endpoint)
- [ ] USE metrics: Utilization, Saturation, Errors (infra)
- [ ] Business metrics: comparisons, searches, signups
- [ ] Alerts: error rate > 1%, latency p99 > 1s, disk > 80%
- [ ] On-call rotation (PagerDuty/Opsgenie)

### Task 8.5: Security Hardening [P1, 2 days]
**Files**: Nginx config, Django settings, headers
**Acceptance Criteria**:
- [ ] CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] Security.txt, robots.txt
- [ ] Dependency scanning (Dependabot/Trivy)
- [ ] Container scanning in CI
- [ ] Penetration test (before launch)

---

## STREAM 9: Documentation & Content
**Lead**: Technical Writer | **Dependencies**: Stream 3 (features exist)

### Task 9.1: User Guides & How-Tos [P2, 3 days]
**Files**: `docs/user/`, FE `src/pages/GuidesPage.tsx`
**Acceptance Criteria**:
- [ ] "How to choose your first credit card"
- [ ] "Understanding annual fee waivers"
- [ ] "Maximizing lounge access benefits"
- [ ] "Credit card vs debit card in Bangladesh"
- [ ] SEO-optimized, readable (Flesch-Kincaid < 8th grade)

### Task 9.2: Bengali Glossary & Localization Prep [P2, 3 days]
**Files**: `src/data/glossary-bn.ts`, `src/i18n/` (framework)
**Acceptance Criteria**:
- [ ] 50+ terms translated (APR → বার্ষিক শতকরা হার)
- [ ] Currency formatting: BDT locale
- [ ] Date formatting: Bengali calendar option
- [ ] RTL-ready CSS (logical properties)
- [ ] Language switcher component (EN/BN)

### Task 9.3: API Documentation [P1, 2 days]
**Files**: `docs/api/`, OpenAPI/Swagger, Redoc
**Acceptance Criteria**:
- [ ] Auto-generated from DRF (drf-spectacular)
- [ ] Examples for all endpoints
- [ ] Authentication guide
- [ ] Rate limits, error codes
- [ ] Interactive "Try it" console

### Task 9.4: Developer Documentation [P1, 2 days]
**Files**: `docs/dev/`, `README.md`, `CONTRIBUTING.md`
**Acceptance Criteria**:
- [ ] Local dev setup (Docker, env vars)
- [ ] Architecture diagram
- [ ] Coding standards, git workflow
- [ ] Deployment runbooks
- [ ] Incident response playbook

---

## STREAM 10: Analytics & Growth
**Lead**: Growth Engineer | **Dependencies**: Stream 7 (auth), Stream 8 (PostHog)

### Task 10.1: Event Tracking Implementation [P0, 2 days]
**Files**: `src/lib/analytics.ts`, PostHog events
**Acceptance Criteria**:
- [ ] Events: `page_view`, `search`, `filter_apply`, `card_select`, `compare_start`, `compare_share`, `card_detail_view`, `quiz_start`, `quiz_complete`, `calculator_use`, `signup`, `login`
- [ ] Properties: card_id, bank, filters, referrer, utm_*
- [ ] User properties: tier, saved_comparisons, email_opt_in
- [ ] GDPR-compliant (opt-out, delete data)

### Task 10.2: Conversion Funnel Dashboard [P1, 2 days]
**Files**: PostHog dashboards, cohorts
**Acceptance Criteria**:
- [ ] Funnel: Visit → Search → Filter → Select → Compare → Share
- [ ] Drop-off analysis per step
- [ ] Segment by: device, source, new/returning
- [ ] Weekly automated report to Slack

### Task 10.3: A/B Testing Framework [P2, 3 days]
**Files**: `src/lib/experiments.ts`, PostHog feature flags
**Acceptance Criteria**:
- [ ] Experiment: hero CTA text, quiz vs browse default, card layout
- [ ] Random assignment (consistent per user)
- [ ] Statistical significance calculator
- [ ] Auto-stop on significance or harm
- [ ] Results dashboard

### Task 10.4: SEO & Content Strategy [P2, 3 days]
**Files**: `src/pages/Sitemap.tsx`, `robots.txt`, meta tags
**Acceptance Criteria**:
- [ ] Dynamic sitemap.xml (cards, categories, guides)
- [ ] Schema.org: Product, FAQPage, BreadcrumbList
- [ ] Core Web Vitals optimization
- [ ] Target keywords: "best credit card bangladesh", "credit card comparison bd"
- [ ] Blog/content calendar (2 posts/month)

---

## Task Assignment Template (for Sub-Agents)

When assigning a task to a sub-agent, use this format:

```
TASK ASSIGNMENT
================
Stream: [1-10]
Task ID: [e.g., 3.2]
Title: [Task Title]
Priority: [P0/P1/P2/P3]
Estimated Effort: [X days]
Dependencies: [Task IDs or "None"]
Files to Modify: [List key files]
Acceptance Criteria: [Copy from above]
Definition of Done:
  - Code complete & reviewed
  - Tests passing (unit + e2e if applicable)
  - Deployed to staging
  - Demoed to Product Owner
  - Documentation updated
```

---

## Coordination Protocol

### Daily (Async):
- Each stream posts standup in GitHub Discussions/Slack:
  - Yesterday: completed tasks
  - Today: planned tasks
  - Blockers: need help from [stream X]

### Weekly (Sync - 30 min):
- Monday: Sprint planning (Product Owner + all leads)
- Wednesday: Mid-sprint check-in (blockers, scope)
- Friday: Demo + Retrospective

### Escalation:
- Blocker > 1 day → Product Owner intervenes
- Cross-stream dependency → Product Owner coordinates
- Scope change → Product Owner approves (with trade-off)

---

*This task breakdown is the source of truth for work assignment. Update as tasks are created/completed in GitHub Issues.*

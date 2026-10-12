# Stream 5: Testing & Quality Assurance - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-5/` - This is a git worktree on branch `stream-5`

## Sprint 1 Tasks (Priority Order)

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
5. Card detail popup → image gallery navigation
6. Category page → filter → pagination
7. Recommendation quiz → results → share
8. Calculator → input spend → results ranked
9. Responsive: mobile/tablet/desktop breakpoints
10. Accessibility: tab navigation, ARIA
11. Error states: API down, no results, network error

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

## Git Workflow
```bash
git add -A
git commit -m "stream-5: [task-id] description"
git push origin stream-5
gh pr create --title "Stream 5: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Frontend: `/home/ubuntu/worktrees/stream-5/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:5"`

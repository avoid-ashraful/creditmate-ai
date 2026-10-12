# Stream 10: Analytics & Growth - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-10/` - This is a git worktree on branch `stream-10`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-10: [task-id] description"
git push origin stream-10
gh pr create --title "Stream 10: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Frontend: `/home/ubuntu/worktrees/stream-10/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:10"`

# Stream 9: Documentation & Content - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-9/` - This is a git worktree on branch `stream-9`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-9: [task-id] description"
git push origin stream-9
gh pr create --title "Stream 9: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Full repo: `/home/ubuntu/worktrees/stream-9/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:9"`

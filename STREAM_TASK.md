# Stream 3: Core Frontend Features - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-3/` - This is a git worktree on branch `stream-3`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-3: [task-id] description"
git push origin stream-3
gh pr create --title "Stream 3: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Frontend: `/home/ubuntu/worktrees/stream-3/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:3"`

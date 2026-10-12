# Stream 6: Search & Discovery - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-6/` - This is a git worktree on branch `stream-6`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-6: [task-id] description"
git push origin stream-6
gh pr create --title "Stream 6: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Backend: `/home/ubuntu/worktrees/stream-6/creditmate-ai-be/`
- Frontend: `/home/ubuntu/worktrees/stream-6/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:6"`

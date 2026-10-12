# Stream 2: Data Pipeline & Quality - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-2/` - This is a git worktree on branch `stream-2`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-2: [task-id] description"
git push origin stream-2
gh pr create --title "Stream 2: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Backend: `/home/ubuntu/worktrees/stream-2/creditmate-ai-be/`
- Improvements doc: `/home/ubuntu/worktrees/stream-2/creditmate-ai-be/docs/improvements.md`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:2"`

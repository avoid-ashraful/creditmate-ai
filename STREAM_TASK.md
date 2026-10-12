# Stream 7: User Accounts & Engagement - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-7/` - This is a git worktree on branch `stream-7`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-7: [task-id] description"
git push origin stream-7
gh pr create --title "Stream 7: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Backend: `/home/ubuntu/worktrees/stream-7/creditmate-ai-be/`
- Frontend: `/home/ubuntu/worktrees/stream-7/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:7"`

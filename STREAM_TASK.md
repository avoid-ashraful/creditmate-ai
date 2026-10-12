# Stream 4: Design System & Accessibility - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-4/` - This is a git worktree on branch `stream-4`

## Sprint 1 Tasks (Priority Order)

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

## Git Workflow
```bash
git add -A
git commit -m "stream-4: [task-id] description"
git push origin stream-4
gh pr create --title "Stream 4: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Frontend: `/home/ubuntu/worktrees/stream-4/creditmate-ai-fe/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:4"`

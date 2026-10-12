# CreditMate AI - Quick Start Guide for Sub-Agents

## Overview
This guide helps each sub-agent (workstream lead) get started with their assigned tasks. The project has **10 parallel workstreams** managed by the Product Owner.

---

## Repository Structure
```
/home/ubuntu/credit/
├── creditmate-ai-fe/          # React/TypeScript Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components (routes)
│   │   ├── services/          # API layer
│   │   ├── styles/            # CSS/Styled Components
│   │   ├── types/             # TypeScript interfaces
│   │   └── dummy-data/        # Development mock data
│   ├── package.json
│   └── TESTING.md
├── creditmate-ai-be/          # Django REST Framework Backend
│   ├── credit_mate_ai/        # Django project settings
│   ├── credit_cards/          # Credit card app
│   ├── banks/                 # Banks app
│   ├── common/                # Shared utilities
│   └── docs/improvements.md   # Data pipeline improvements
├── ENHANCEMENT_PLAN.md        # This project's strategy
├── TASK_BREAKDOWN.md          # Detailed tasks per stream
└── github_issues.json         # Pre-generated GitHub issues
```

---

## Prerequisites (All Streams)

### Required Tools
```bash
# Node.js 18+ (for frontend)
nvm install 18 && nvm use 18

# Python 3.12+ (for backend)
# Already available in environment

# Docker & Docker Compose (for local services)
# GitHub CLI (for issue management)
gh auth login
```

### Environment Setup
```bash
# Clone and navigate
cd /home/ubuntu/credit

# Frontend dependencies
cd creditmate-ai-fe
npm install

# Backend dependencies (using uv/pip)
cd ../creditmate-ai-be
pip install -e .  # or: pip install -r requirements.txt

# Start local services (PostgreSQL, Redis, Elasticsearch)
docker-compose up -d
```

---

## Stream-Specific Quick Starts

### Stream 1: Backend API & Infrastructure
```bash
cd /home/ubuntu/credit/creditmate-ai-be

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver 0.0.0.0:8000

# Run tests
pytest credit_cards/tests/ -v
```

**Key Files to Know**:
- `credit_cards/models.py` - CreditCard model (needs nullable fields fix)
- `credit_cards/api/views.py` - ViewSet with filtering
- `credit_cards/api/serializers.py` - Serializers
- `credit_mate_ai/settings.py` - Django settings

### Stream 2: Data Pipeline & Quality
```bash
cd /home/ubuntu/credit/creditmate-ai-be

# Review existing crawler
cat banks/services/content_extractor.py
cat banks/services/llm_parser.py

# Run crawler manually
python manage.py crawl_banks --bank="Eastern Bank Limited"

# Check improvements plan
cat docs/improvements.md
```

### Stream 3: Core Frontend Features
```bash
cd /home/ubuntu/credit/creditmate-ai-fe

# Start dev server
npm start
# Opens http://localhost:3000

# Run tests
CI=true npm test -- --watchAll=false

# Type checking
npm run check-types

# Linting
npm run check-lint
```

**Key Files to Know**:
- `src/pages/HomePage.tsx` - Main page with filters
- `src/pages/ComparisonPage.tsx` - Comparison view
- `src/components/CardComparisonTable.tsx` - Comparison table
- `src/components/FilterPanel.tsx` - Filter sidebar
- `src/services/api.ts` - API service (needs BE connection)

### Stream 4: Design System & Accessibility
```bash
cd /home/ubuntu/credit/creditmate-ai-fe

# View current styles
cat src/styles/index.css
cat src/styles/StyledComponents.tsx

# Start Storybook (after setup)
npm run storybook
```

### Stream 5: Testing & QA
```bash
cd /home/ubuntu/credit/creditmate-ai-fe

# Current test status
CI=true npm test -- --watchAll=false

# Install Playwright (for E2E)
npm install -D @playwright/test
npx playwright install

# Run Playwright tests
npx playwright test
```

### Stream 6: Search & Discovery
```bash
# Start Elasticsearch
docker run -d --name elasticsearch \
  -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Or use Meilisearch (lighter)
docker run -d --name meilisearch \
  -p 7700:7700 \
  getmeili/meilisearch:v1.5
```

### Stream 7: User Accounts & Engagement
```bash
cd /home/ubuntu/credit/creditmate-ai-be

# Check auth setup
cat credit_mate_ai/settings.py | grep -A 20 "REST_FRAMEWORK"

# JWT settings
cat credit_mate_ai/settings.py | grep -A 10 "SIMPLE_JWT"
```

### Stream 8: DevOps & Deployment
```bash
# Check existing Docker files
ls -la /home/ubuntu/credit/creditmate-ai-fe/Dockerfile 2>/dev/null || echo "No FE Dockerfile"
ls -la /home/ubuntu/credit/creditmate-ai-be/Dockerfile 2>/dev/null || echo "No BE Dockerfile"

# GitHub Actions
mkdir -p /home/ubuntu/credit/.github/workflows
```

### Stream 9: Documentation & Content
```bash
# View existing docs
cat /home/ubuntu/credit/creditmate-ai-fe/prd-creditmate-ai.md
cat /home/ubuntu/credit/creditmate-ai-fe/README.md
cat /home/ubuntu/credit/creditmate-ai-fe/GlossaryPage.tsx
```

### Stream 10: Analytics & Growth
```bash
cd /home/ubuntu/credit/creditmate-ai-fe

# Check current analytics setup
grep -r "analytics\|posthog\|gtag" src/ --include="*.tsx" --include="*.ts"

# PostHog setup (when ready)
# npm install posthog-js
```

---

## First Tasks for Each Stream (Sprint 1)

| Stream | First Task | Command to Start |
|--------|-----------|------------------|
| 1 | Fix DB Schema | `cd creditmate-ai-be && python manage.py makemigrations credit_cards` |
| 2 | Review Crawler | `cat creditmate-ai-be/docs/improvements.md` |
| 3 | Category Browsing | `cd creditmate-ai-fe && cp src/pages/HomePage.tsx src/pages/CategoryPage.tsx` |
| 4 | Design Tokens | `mkdir -p creditmate-ai-fe/design-tokens` |
| 5 | Fix HomePage Test | `cd creditmate-ai-fe && cat src/pages/HomePage.test.tsx` |
| 6 | ES Setup | `docker run elasticsearch...` |
| 7 | Auth System | `cd creditmate-ai-be && cat credit_mate_ai/settings.py` |
| 8 | CI Pipeline | `mkdir -p .github/workflows` |
| 9 | User Guides | `mkdir -p creditmate-ai-fe/src/pages/GuidesPage.tsx` |
| 10 | Event Tracking | `cd creditmate-ai-fe && mkdir -p src/lib` |

---

## Communication Protocol

### Daily Standup (Async - GitHub Discussions)
Post in the repository's Discussions tab:
```
**Stream [X] - [Date]**
- ✅ Completed: [task IDs]
- 🔄 In Progress: [task IDs]
- 🚫 Blocked: [task ID] - waiting on Stream [Y] for [dependency]
- 📝 Notes: [anything relevant]
```

### Weekly Sync (Sync - 30 min)
- **Monday 10:00 UTC**: Sprint planning
- **Wednesday 10:00 UTC**: Mid-sprint check-in
- **Friday 10:00 UTC**: Demo + Retrospective

### Escalation
- Blocker > 24 hours → Tag @product-owner in GitHub issue
- Cross-stream dependency → Product Owner coordinates
- Scope change → Product Owner approval required

---

## Useful Commands Reference

### Frontend
```bash
cd creditmate-ai-fe
npm start              # Dev server
npm test               # Watch mode tests
npm run build          # Production build
npm run lint           # Fix linting
npm run format         # Prettier format
npm run check-types    # TypeScript check
```

### Backend
```bash
cd creditmate-ai-be
python manage.py runserver          # Dev server
python manage.py migrate            # Run migrations
python manage.py makemigrations     # Create migrations
pytest                              # All tests
pytest credit_cards/tests/ -v       # Specific app tests
pytest -k "test_credit_card_list"   # Specific test
```

### Docker
```bash
docker-compose up -d        # Start services
docker-compose logs -f      # Follow logs
docker-compose down         # Stop services
docker-compose exec backend bash  # Shell into backend
```

---

## Definition of Done (All Streams)

A task is **DONE** when:
- [ ] Code implemented and self-reviewed
- [ ] Unit tests pass (new + existing)
- [ ] E2E tests pass (if applicable)
- [ ] Code reviewed by at least 1 other engineer
- [ ] Deployed to staging environment
- [ ] Demoed to Product Owner
- [ ] Documentation updated (README, API docs, comments)
- [ ] No linting/type errors
- [ ] Accessibility check passes (Stream 4)

---

## Getting Help

### Documentation
- `ENHANCEMENT_PLAN.md` - Full strategy
- `TASK_BREAKDOWN.md` - Detailed tasks with acceptance criteria
- `creditmate-ai-fe/CLAUDE.md` - Frontend dev guide
- `creditmate-ai-be/docs/improvements.md` - Data pipeline plan

### Key Contacts
- **Product Owner**: Main agent (this session)
- **Technical Questions**: Create GitHub issue with `question` label
- **Urgent Blockers**: Tag @product-owner in issue

---

## Next Steps

1. **Claim your stream** - Reply to the GitHub Discussion "Stream Assignments"
2. **Read your tasks** - Open `TASK_BREAKDOWN.md` and find your stream
3. **Set up environment** - Follow the stream-specific quick start above
4. **Start first task** - Begin with the Sprint 1 task for your stream
5. **Post first standup** - End of day 1, post in Discussions

---

*Welcome to the team! Let's build something great together.* 🚀

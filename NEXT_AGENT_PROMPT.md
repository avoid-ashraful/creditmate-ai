# CreditMate AI — session handoff (2026-10-12)

Read this file and TASK_BREAKDOWN.md before changing anything. This replaces the older handoff. Do not follow its force-push, git-add-all, copied-worktree, or stale test instructions. The original handoff is backed up at /home/ubuntu/credit-agent-control/NEXT_AGENT_PROMPT.original.md.

## User direction

Resume development as product manager, with four Codex CLI workers and four additional OpenCode workers, eight external CLI workers total. Delegate implementation/testing through codexn/OpenCode with full access and no approval prompts. Keep assignments isolated, review actual source/checks, and advance only accepted increments. Develop the complete task breakdown; do not redefine the goal as local checks alone. This session is being finalized at the user's request; inspect live process state before restarting anything.

Remote CI stays pending. User authorized configuring SUBMODULE_TOKEN, but no dedicated read-only token was available. Existing gh OAuth credentials have broad repo/workflow privileges; do not put that token into the secret. Obtain a fine-grained PAT restricted to creditmate-ai-fe and creditmate-ai-be, Contents read-only, and set the parent repository secret through protected stdin/file without printing it. Do not dispatch CI, publish containers, deploy staging/production, run paid crawls, or modify real financial records without the relevant configuration/authorization.

## Repositories and safe workspaces

Parent: avoid-ashraful/creditmate-ai, FE: avoid-ashraful/creditmate-ai-fe, BE: avoid-ashraful/creditmate-ai-be. All private, default branch master. Parent contains gitlinks; component code must be committed and reachable on its own remote before updating parent pins.

/home/ubuntu/credit is the original workspace and still contains inherited dirty frontend files. Preserve them; do not reset/clean or force-push. /home/ubuntu/worktrees/stream-* are historical copied-component worktrees; do not use them for new implementation.

Use independent parent/FE/BE worktrees under /home/ubuntu/credit-workers/stream-{1,3,5,8} and /home/ubuntu/credit-workers/opencode-stream-{2,4,6,9}. PM integration worktree: /home/ubuntu/credit-workers/integration, branch pm/integration. Untracked AGENTS.md, STREAM_TASK.md, opencode.json and historical NEXT_AGENT_PROMPT.md copies in workers are manager configuration, exclude them from commits. Stage explicit paths only.

## Verified merged work

- Nullable fees/APR baseline: parent PR73. Unknown fee/APR values remain null, genuine zero remains zero.
- Frontend Django-response normalization: FE PR3 and parent PR74. Decimal strings, bank fields, filters, timestamps and lounge values normalized without invented defaults.
- Task5.1 HomePage tests/dependency fix: FE PR4 and parent PR75. Canonical npm lock, compatible MSW/Testing Library, real comparison navigation; 49 tests and clean install/types/lint/build passed.
- Task1.3 Redis caching/API contracts: BE PR8 and parent PR76. Canonical query-aware cache keys, atomic version counters, transaction-on-commit invalidation, bounded pagination, expanded serializers, canonical search-suggestions path; 366 tests passed on locmem and Redis DB14 separately.

See SESSION_STATUS.json for final additional merges/checkpoints and exact commits. The machine-readable control record is /home/ubuntu/credit-agent-control/session-finalization.json. Never assume a worker's report or progress checkbox means the work was accepted or deployed.

- Task3.1 categories: FE PR5 merged, six routes with real pagination;63 standalone tests and78 combined category/guide/QA tests passed.
- Task9.1 guides: FE PR6 and BE PR10 merged, including metadata cleanup, corrected sourced facts and readability evidence.
- Task2.1 local crawler implementation: BE PR9 merged,818 tests on the cache+quality tree; production deployment remains pending.

## Remaining work and checkpoints

Inspect all current source/status/report files before assigning next tasks. Tasks1.4 rates/request validation,2.1 crawler quality,3.1 categories,4.1 tokens,5.2 E2E,6.1 search,8.1 CI,9.1 guides were active during finalization. SESSION_STATUS.json records their final status. Important limitations:

- Task2.1 live deployment, real LLM crawls and running production beat remain unproven. Tests use fixtures/providers; reject foreign currency/monthly periods/conditional waivers without inventing conversions. Bank migration parity is checked; credit_cards APR migration drift was pre-existing.
- Task5.2 covers a runnable synthetic-data subset. Full acceptance includes quiz, calculator, categories, popup gallery, compare/share, errors, keyboard and three breakpoints. Do not mark complete or skip required paths because pages are missing. Coordinate verified category/quiz/calculator commits before finishing.
- Task6.1 initial 483 real-engine tests did not prove default automatic scheduling. Final review found queue mode never dispatched and overlapping drains lacked claiming/locking. A corrective worker was assigned; inspect its final report/source/tests. Do not merge or claim durable auto-sync until these are addressed and integration is tested.
- Task9.1 initial 61 tests missed guide->Home metadata leakage. A corrective worker was assigned for snapshot/restore cleanup and route regression. Preserve corrected Bangladesh Bank qualifications and true Home filter flow; client-rendered metadata does not prove crawler/static SEO.
- Task8.1 implementation/local container checks are separate from hosted CI, GHCR publication and staging. Local parent commits80e079c/bf30c7e, FE55c11bd, BE813dee0 contain infrastructure. Keep the workflow unpublished/remote verification pending unless that user decision changes; do not cherry-pick its old gitlinks over later integrated components.
- Separate verified baseline issue: backend has_lounge_access and API filters treat nonempty zero/None/no-access text as access. Correct API/model/search semantics and add agreement regressions. Travel classification inherits this issue.
- CRA dependency audit reported110 issues (6low,16moderate,84high,4critical). Task8.5 security hardening remains pending; no audit fix --force or unrelated dependency rewrite.

The all-task audit is /home/ubuntu/credit-agent-control/delivery-audit.json. Streams7(auth) and10(analytics) remain unassigned. Original queues: Codex1:1.3->1.4->1.5;3:3.1->3.6->3.2->3.3;5:5.1->5.2->5.4;8:8.1->8.5->8.2. OpenCode2:2.1->2.2->2.3;4:4.1->4.2Storybook->4.3accessibility;6:6.1->6.2autocomplete/facets->6.3advancedsearch;9:9.1->9.2Bengali/localization->9.3API docs. Remaining tasks stay in scope, not discarded by these queues.

## Runner operations and model history

Control directory: /home/ubuntu/credit-agent-control. Read status.json, opencode-status.json, finalize-*-status.json, repair-8-status.json, worker-monitor-snapshot.json, task reports, review JSONs and inboxes. Run python3 monitor.py for incremental actual evidence. Check /proc PID state/cmdline, not status labels alone. Managers were stopped during finalization, STOP and STOP_OPENCODE prevent future assignments. Inspect SESSION_STATUS.json and current processes before removing those flags/restarting; never duplicate live workers.

Task-local codexn wrapper uses compatible Codex0.80, NVIDIA chat proxy on127.0.0.1:8769, and persisted manager inboxes. Do not modify global codexn or print provider credentials. model-policy.json currently prefers z-ai/glm-5.3 for active native tasks; Kimi fallback is available. Original Step5-free OpenCode workers exhausted provider quota; MiMo-v2.6-flash-free handled the resumed work. MiMo also reached provider.quota429 during final checks; choose/probe an available good model next session before reassigning failed work. The Nemotron Ultra planning/Lightning implementation trial failed to yield a verified CI increment, so no speed/quality win is claimed. User allows trying good available models and a future focused Nemotron Lightning/Ultra trial, but measure verified delivery rather than response time.

OpenCode2.0.27 run --standalone --auto --agent build --model opencode/mimo-v2.6-flash-free --format json. ALWAYS give each prompt an explicit absolute writable worker directory and require absolute paths/cd for shell calls; fresh sessions otherwise interpreted environment cwd as /home/ubuntu/credit. No nested subagents in the external workers. Avoid giant resumed contexts when a fresh scoped corrective turn is better. Save exact prompt/log/PID/model and use real tool outcomes, not tool-call-shaped text.

## Local validation environment

Node24/npm11 host; React18/TS4.9/CRA5. npm ci --legacy-peer-deps, Jest --watchAll=false --maxWorkers=2, npm run check-types/check-lint/build. Install the exact lock after cherry-picking QA; stale node_modules initially caused missing @testing-library/dom.

Python3.12 with uv. Native PostgreSQL16 on5432, Unix peer role ubuntu. Isolated databases creditmate_worker1/5/8 and creditmate_opencode2/4/6/9. DATABASE_URL=postgresql:///creditmate_workerN, DEBUG=True, CACHE_BACKEND=locmem for ordinary tests. Do not use TCP URLs without valid credentials.

Redis127.0.0.1:6379 DB14 ONLY is the dedicated cache test database. Never flush existing DB0/1 or other shared state. Cache fixture protects DB14; pytest socket rules must permit local Redis only when intentionally running those checks.

Docker29/Compose2.40 supplied under control/docker-data; do not kill shared daemon or unrelated services. Elasticsearch8.19.3 uses own test project at127.0.0.1:19200; CI-local PostgreSQL compose uses15432 to avoid native5432. Stop each worker's own test containers/servers. actionlint1.7.12 ARM64 at control/bin/actionlint.

T3 preview status/open explicitly returned unavailable (no desktop automation host). Headless browser fallback is allowed on that condition; no guide screenshot was claimed. Do not claim rendered review from source/Jest alone.

## Delivery rules

User authorized merging PRs that are actually ready. Review source, relevant checks and combined dependencies first; exact-tree equality can transfer already-tested evidence when cherry-pick order differs. Hold incomplete/unverified increments as preserved checkpoints. Link every created/worked PR with T3 link_pull_request immediately and audit list_thread_pull_requests before finishing PR work. Never merge placeholder stream PRs or unrelated FE PR2 merely because GitHub says mergeable. Use merge commits/matching head, no force pushes, admin bypass or assumed remote green checks. Keep GitHub issue references accurate; duplicate issue titles exist.

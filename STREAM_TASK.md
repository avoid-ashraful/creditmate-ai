# Stream 8: DevOps & Deployment - Sprint 1 Tasks

## Your Workspace
`/home/ubuntu/worktrees/stream-8/` - This is a git worktree on branch `stream-8`

## Sprint 1 Tasks (Priority Order)

### Task 8.1: GitHub Actions CI Pipeline [P1, 2 days]
**Files**: `.github/workflows/ci.yml`, `docker-compose.ci.yml`
**Acceptance Criteria**:
- [ ] On PR: lint → typecheck → unit tests → build
- [ ] On merge to main: build → push image → deploy staging
- [ ] Parallel jobs for FE and BE
- [ ] Cache node_modules, pip dependencies
- [ ] Artifacts: test reports, coverage, build logs

### Task 8.2: Staging Environment [P1, 2 days]
**Files**: `docker-compose.staging.yml`, Kubernetes manifests (staging)
**Acceptance Criteria**:
- [ ] Staging URL: staging.creditmate.ai
- [ ] Real data (subset), real APIs
- [ ] Auto-deploy on main merge
- [ ] Separate DB, Redis, ES from prod
- [ ] Smoke tests post-deploy

### Task 8.3: Production Kubernetes Configs [P1, 3 days]
**Files**: `k8s/` (base, overlays), Helm charts
**Acceptance Criteria**:
- [ ] Namespace separation (prod, staging)
- [ ] Deployments: FE (nginx), BE (gunicorn), Celery workers
- [ ] HPA: CPU > 70%, memory > 80%
- [ ] Ingress: TLS, rate limit, WAF rules
- [ ] Secrets: External Secrets Operator / SealedSecrets
- [ ] PodDisruptionBudgets, resource limits

### Task 8.4: Monitoring & Alerting [P1, 2 days]
**Files**: Grafana dashboards, Prometheus rules, Alertmanager
**Acceptance Criteria**:
- [ ] RED metrics: Rate, Errors, Duration (per endpoint)
- [ ] USE metrics: Utilization, Saturation, Errors (infra)
- [ ] Business metrics: comparisons, searches, signups
- [ ] Alerts: error rate > 1%, latency p99 > 1s, disk > 80%
- [ ] On-call rotation (PagerDuty/Opsgenie)

### Task 8.5: Security Hardening [P1, 2 days]
**Files**: Nginx config, Django settings, headers
**Acceptance Criteria**:
- [ ] CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] Security.txt, robots.txt
- [ ] Dependency scanning (Dependabot/Trivy)
- [ ] Container scanning in CI
- [ ] Penetration test (before launch)

## Git Workflow
```bash
git add -A
git commit -m "stream-8: [task-id] description"
git push origin stream-8
gh pr create --title "Stream 8: [Task Description]" --body "Closes #<issue-number>"
```

## Key References
- Full repo: `/home/ubuntu/worktrees/stream-8/`
- Issues: `gh issue list --repo avoid-ashraful/creditmate-ai --label "stream:8"`

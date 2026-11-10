# CreditMate platform Helm chart

Deploys the whole CreditMate platform — Django API, React frontend, Celery
worker + beat, migrations — replacing the deprecated Kustomize manifests in
`k8s/` (kept for one release as reference). Design: implementation plan §4 in
`~/workspace/goals/creditmate-ai-credit-card-comparison-app/files/IMPLEMENTATION_PLAN_K8S_AGENTS_KAFKA_PGVECTOR_EVALS_COST.md`.

## Quick start (local, k3d)

```bash
scripts/cluster-up.sh            # cluster + ingress-nginx, cert-manager, metrics-server, KEDA, kube-prometheus-stack
# add to /etc/hosts:  127.0.0.1 creditmate.localhost
scripts/cluster-up.sh --with-app # installs this chart with values-local.yaml
curl -k https://creditmate.localhost/api/readyz/
```

## What renders

| Template | Contents |
|---|---|
| `api.yaml` | API Deployment (gunicorn, healthz/readyz probes, resources from the old base manifest) + ClusterIP Service |
| `frontend.yaml` | Frontend Deployment (nginx, port **3000**) + Service |
| `celery-worker.yaml` / `celery-beat.yaml` | Worker; beat hard-coded to **1 replica, Recreate** |
| `migrate-job.yaml` | `migrate --noinput` Helm pre-install/pre-upgrade hook Job (+ optional local seed Job) |
| `configmap.yaml` | Non-secret config. Keys are the **real** env names from `credit_mate_ai/settings.py` (`SECRET_KEY`-style, `ALLOWED_HOSTS`, `DB_*`, `REDIS_CACHE_URL`, `CELERY_BROKER_URL`, …) |
| `secret.yaml` | Backend Secret — rendered **only** when `secrets.create=true` (local, from the git-ignored secrets file) |
| `external-secret.yaml` | ExternalSecret for staging/production (`externalSecrets.enabled`) |
| `postgres.yaml` / `redis.yaml` | First-party **local-only** StatefulSets (Postgres `pgvector/pgvector:pg17`, Redis `redis:7-alpine`), behind `postgres.enabled` / `redis.enabled` |
| `ingress.yaml` | ingress-nginx, cert-manager TLS annotation, rate-limit + ModSecurity annotations from the old base ingress |
| `autoscaling.yaml` | HPA for API + frontend; PDBs for API/frontend/worker |
| `keda-scaledobject.yaml` | KEDA Redis-list trigger scaling the worker on Celery queue length (no worker CPU-HPA when enabled) |
| `networkpolicy.yaml` | Default-deny + explicit allows (ingress→FE/API, FE→API, backend pods→PG/Redis/HTTPS, monitoring→API scrape, KEDA→Redis) |
| `monitoring.yaml` | ServiceMonitor for the API `/metrics`; Grafana dashboard ConfigMaps |
| `prometheusrule.yaml` | All rules from `monitoring/prometheus/rules/` (alerts + recording + data-quality, 26 rules) as one PrometheusRule |

## Values

| File | Environment | Data services | Secrets |
|---|---|---|---|
| `values.yaml` | safe defaults | in-cluster (local-shaped) | none rendered |
| `values-local.yaml` | k3d on a laptop | in-cluster PG/Redis | chart-rendered, **documented throwaway local values** |
| `values-staging.yaml` | staging | external (`*.internal` hosts — replace with the real managed endpoints per environment) | ExternalSecret `creditmate/staging/backend` |
| `values-production.yaml` | production | external | ExternalSecret `creditmate/production/backend` |

Key values (full list with comments in `values.yaml`): `api.image`, `frontend.image`,
`config.*` (environment/hosts/DB/Redis/search/feature flags `EVENT_STREAMING_ENABLED`,
`VECTOR_SEARCH_ENABLED`, `ADVISOR_ENABLED` — all default off), `postgres.enabled`,
`redis.enabled`, `ingress.host/clusterIssuer`, `autoscaling.api/frontend`,
`keda.*` (queue-length target 10/worker), `networkPolicy.enabled`,
`monitoring.*`, `migrate.enabled`, `seed.enabled` (local only).

Local secrets beyond the throwaway defaults (e.g. a Gemini key) go in
`charts/creditmate/values-local-secrets.yaml` — git-ignored; start from
`values-local-secrets.example.yaml`. **No real secret value is ever committed.**

## Verify (the smoke used for this chart)

```bash
helm lint charts/creditmate
for env in local staging production; do
  helm template creditmate charts/creditmate -n creditmate -f charts/creditmate/values-$env.yaml > /tmp/render-$env.yaml
  grep -n REPLACE_ME /tmp/render-$env.yaml && echo "PLACEHOLDER LEAK in $env" || echo "$env: clean"
done
```

## Known local-build note — frontend image (NOT fixed by this chart)

The FE Dockerfile currently **fails the build unless `REACT_APP_API_BASE_URL`
is a public HTTPS URL** (it rejects localhost). For a local cluster build you
must either build the FE image against the `https://creditmate.localhost`
ingress URL, or wait for the FE repo change that adds a local-only build-arg
override (owned by the FE stream, deliberately not part of this chart PR).
The production guard itself should stay.

## Corrections vs the old Kustomize manifests

- Frontend port **3000** (the real `nginx.conf` in creditmate-ai-fe), not 8080;
  probes hit `/` (the SPA nginx has no `/healthz` route).
- ConfigMap keys use the variable names `settings.py` actually reads.
- Migrations now run (hook Job) and NetworkPolicies now exist — both were
  documented gaps in `k8s/README.md`.

## Rollback

See `docs/runbooks/k8s-rollback.md`. Architecture: `docs/diagrams/platform.md`.

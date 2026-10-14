# Health checks and metrics endpoints

Reference for what each component exposes, what the Kubernetes probes call, and what Prometheus scrapes.

> **Status:** these endpoints are the contract this infrastructure expects. The backend and frontend
> repositories are git submodules that are not checked out in this worktree, so their implementation
> is **not verified here**. Confirm each row before the first deploy (see "Verifying" below).

## Endpoints

| Component | Path / port | Probe use | Passing means | Owner to implement |
|---|---|---|---|---|
| Backend (gunicorn/Django) | `GET /api/healthz/` :8000 | startup, liveness | process is serving HTTP; no dependency checks | creditmate-ai-be |
| Backend | `GET /api/readyz/` :8000 | readiness | DB, Redis and Elasticsearch are reachable | creditmate-ai-be |
| Backend | `GET /metrics` :8000 | Prometheus | django-prometheus metrics exposed | creditmate-ai-be |
| Frontend (nginx) | `GET /healthz` :8080 | readiness, liveness | nginx serves; returns `200 ok` without touching the upstream | creditmate-ai-fe |
| Celery worker | `celery inspect ping` | liveness | worker answers a broker ping within 10s | (from image) |
| Celery beat | `/tmp/celerybeat.pid` + `kill -0` | liveness | beat process exists | (from image) |

### Why liveness and readiness differ

- **Liveness** restarts a container. It must not depend on other services. If Redis is down, restarting
  the backend does not help, and restarts would only add load.
- **Readiness** removes a pod from the Service endpoints. A backend with a broken database connection
  should stop receiving traffic, not be killed.

### Expected responses

- `/api/healthz/` and `/api/readyz/` return `200` with a small body. Any `5xx` or timeout counts as failing.
- `/api/readyz/` should return `503` (not `200`) when a dependency is down, so the readiness probe fails.
- Do not put secrets or version details that aren't needed in these bodies. They are unauthenticated.
  Because `/api` is routed through the public ingress, these two paths are reachable from the internet.

## Metrics

Metric names used by the alert and recording rules (`monitoring/prometheus/rules/`):

| Metric | Source | Used for |
|---|---|---|
| `django_http_requests_total_by_view_transport_method_total` | django-prometheus | request rate (RED: Rate) |
| `django_http_responses_total_by_status_view_method_total` | django-prometheus | error ratio (RED: Errors) |
| `django_http_requests_latency_seconds_by_view_method_bucket` | django-prometheus | latency p99 (RED: Duration) |
| `node_filesystem_*`, `node_cpu_seconds_total`, `node_memory_*`, `node_load1` | node_exporter | USE: disk, CPU, memory, saturation |
| `kube_pod_container_status_restarts_total`, `kube_deployment_status_*`, `kube_horizontalpodautoscaler_*` | kube-state-metrics | Kubernetes health |
| `redis_up`, `pg_up`, `elasticsearch_cluster_health_status` | redis/postgres/elasticsearch exporters | dependency health |
| `creditmate_comparisons_total`, `creditmate_searches_total`, `creditmate_signups_total` | **not yet implemented** | business dashboard row |

The three business counters are referenced by the Grafana dashboard but **do not exist yet**. The backend
must add them (`prometheus_client` Counters, incremented in the comparison, search and signup code paths)
before that row shows data.

## Verifying

Run these after the first deploy to staging:

```bash
# Replace the host and token; never paste production credentials into a shell history.
curl -fsS https://staging.creditmate.ai/api/healthz/ -o /dev/null -w '%{http_code}\n'
scripts/smoke-test.sh https://staging.creditmate.ai
kubectl -n creditmate-staging get pods -l app.kubernetes.io/part-of=creditmate
kubectl -n creditmate-staging exec deploy/creditmate-backend -- python -c 'import urllib.request as u; print(u.urlopen("http://127.0.0.1:8000/api/readyz/").status)'
```

Then in Prometheus, confirm each `creditmate-*` target is `UP` (`up{job=~"creditmate-.*"}`) and that
`creditmate:http_requests:rate5m` returns series once traffic arrives.

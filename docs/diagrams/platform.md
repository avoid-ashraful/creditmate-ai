# CreditMate platform architecture (Helm / Kubernetes)

Rendered from the chart in `charts/creditmate/`. Local profile shown;
staging/production replace the in-cluster Postgres/Redis with managed
external services and the chart-rendered Secret with an ExternalSecret.

```mermaid
flowchart TB
    user([Browser]) -->|HTTPS| ing[ingress-nginx<br/>cert-manager TLS<br/>rate limit + ModSecurity]
    ing -->|/| fe[Frontend<br/>nginx:3000, HPA]
    ing -->|/api, /admin| api[Django API<br/>gunicorn, HPA<br/>healthz / readyz]
    fe -.->|browser calls /api| api
    beat[Celery beat<br/>1 replica, Recreate] -->|schedule| redis[(Redis 7<br/>broker + cache)]
    worker[Celery worker<br/>KEDA on queue length] -->|consume| redis
    api --> redis
    api --> pg[(Postgres 17 + pgvector<br/>StatefulSet, local only)]
    worker --> pg
    beat --> pg
    migrate{{Migrate Job<br/>helm pre-install/upgrade hook}} --> pg
    prom[Prometheus<br/>kube-prometheus-stack] -->|ServiceMonitor /metrics| api
    prom --> rules[[PrometheusRule<br/>monitoring/ rules]]
    graf[Grafana] --> prom
    dash[[Dashboard ConfigMaps<br/>monitoring/ dashboards]] --> graf
    eso[External Secrets Operator<br/>staging/prod] --> secret[(creditmate-backend-secrets)]
    secret -.->|envFrom| api
    secret -.->|envFrom| worker
    cm[[creditmate-config<br/>ConfigMap]] -.->|envFrom| api
```

NetworkPolicies (chart default): default-deny for all CreditMate pods, then
explicit allows — ingress→frontend/API, frontend→API, backend-side pods→
Postgres/Redis/HTTPS, monitoring→API scrape, KEDA→Redis.

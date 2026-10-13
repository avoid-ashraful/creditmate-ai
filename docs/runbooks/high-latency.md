# High latency and saturation

**Alerts:** `CreditmateHighLatencyP99` (site p99 > 1s for 10m), `CreditmateEndpointLatencyP99High` (one endpoint p99 > 1s for 15m), `CreditmateNodeCPUUtilizationHigh` (CPU > 90% for 15m), `CreditmateNodeCPUSaturated` (load > 2 per core for 15m), `CreditmateHPAAtMaxReplicas` (autoscaler pinned at max for 30m).

## 1. Find the slow endpoint

- Dashboard: *Creditmate Overview*, "p99 latency by endpoint".
- Compare with request rate: a latency rise with a traffic spike is capacity; a rise without one is a regression or a slow dependency.

## 2. Check the dependencies first

Slow Postgres, Redis or Elasticsearch shows up as backend latency. Check their panels before scaling the backend.

```bash
kubectl -n <ns> top pods
kubectl -n <ns> get hpa
```

## 3. Capacity

- HPA at max replicas: scaling is exhausted. Raising `maxReplicas` in the overlay is a reviewed change; do it in git, then apply.
  For a short emergency, `kubectl -n <ns> patch hpa creditmate-backend -p '{"spec":{"maxReplicas":12}}'`. Record it, then fix it in git the same day.
- CPU saturated but HPA not at max: HPA reacts within minutes. Check whether `metrics-server` is healthy.
- Memory-bound: gunicorn with 3 workers at 768Mi limit. Check for OOM kills (`kubectl describe pod`).

## 4. Regression

If latency rose right after a deploy, go to [rollback.md](rollback.md). Compare the endpoint's p99 before and after the release.

## 5. Known gaps

- The p99 uses a 5-minute window and will lag short spikes.
- Worker queue depth is not yet exported. A slow Celery queue will not show here.

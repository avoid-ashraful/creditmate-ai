# High error rate (5xx)

**Alerts:** `CreditmateHighErrorRate` (critical, site-wide > 1% for 5m), `CreditmateEndpointErrorRateHigh` (warning, one endpoint > 1% for 10m).

## 1. Scope it (2 minutes)

- Dashboard: *Creditmate Overview*, RED row. Which `view` is failing? Is it one endpoint or all?
- Which deploy? `kubectl -n <ns> rollout history deployment/creditmate-backend`. Did a release land in the last 30 minutes?
- Dependencies: are `redis_up`, `pg_up` and the Elasticsearch status panel healthy? If not, go to [on-call.md](on-call.md).

## 2. Read the errors

```bash
kubectl -n creditmate-prod logs deploy/creditmate-backend --since=15m | grep -E ' 5[0-9]{2} ' | tail -50
kubectl -n creditmate-prod logs deploy/creditmate-backend --since=15m | grep -i -E 'traceback|error' | tail -50
```

Errors are also in Sentry (project for the backend). Filter by the release and the `view` name.

## 3. Decide

| Signal | Action |
|---|---|
| Started within 30 minutes of a deploy | [rollback.md](rollback.md) |
| 502/503/504 from ingress, pods not ready | Check pods: `kubectl -n <ns> get pods`. Crash loops: `kubectl describe pod <pod>` |
| 500 with a single traceback, one endpoint | Hotfix or feature-flag the endpoint off. Do not restart pods to "clear" it |
| Errors from Redis, Postgres or Elasticsearch | Dependency outage. See [on-call.md](on-call.md) |
| Rate limiting (429) rather than 5xx | Not this alert. Check `limit-rps` in the ingress and whether a client is hammering the API |

## 4. Recover and close

- The alert resolves on its own once the error ratio drops under 1% for the `for` window.
- Post in the incident channel: the endpoint, first error time, cause, and the action taken.
- Open a follow-up for any root cause not fixed yet.

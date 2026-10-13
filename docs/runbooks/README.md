# Runbooks

Operational procedures for the Creditmate platform. Each alert in `monitoring/prometheus/rules/creditmate-alerts.yml`
links to one of these pages through its `runbook` annotation.

| Runbook | When to use |
|---|---|
| [staging-deploy.md](staging-deploy.md) | Deploying a build to staging, running migrations, smoke tests |
| [rollback.md](rollback.md) | Reverting a bad release in staging or production |
| [high-error-rate.md](high-error-rate.md) | `CreditmateHighErrorRate`, `CreditmateEndpointErrorRateHigh` |
| [high-latency.md](high-latency.md) | `CreditmateHighLatencyP99`, CPU or saturation alerts, HPA at max |
| [disk-usage.md](disk-usage.md) | `CreditmateNodeDiskUsageHigh`, `CreditmateNodeDiskUsageCritical` |
| [secret-rotation.md](secret-rotation.md) | Rotating database, Redis, Elasticsearch or Django secrets |
| [on-call.md](on-call.md) | Rotation, escalation, dependency outages, anything without a specific runbook |

Health endpoints and metric names are documented in [monitoring/health-checks.md](../../monitoring/health-checks.md).

Commands below use the namespaces `creditmate-staging` and `creditmate-prod`. Replace them if your context differs.
Check the context first: `kubectl config current-context`.

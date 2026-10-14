# On-call

## Rotation

> **Proposed defaults, not yet agreed.** The team must confirm the rotation length, handoff time, acknowledgement
> target and escalation steps below before they are relied on.

- Proposed: primary and secondary on-call, weekly rotation.
- Paging: `critical` alerts go to PagerDuty (`monitoring/alertmanager/alertmanager.yml.tmpl`, receiver `pagerduty-oncall`).
  `warning` alerts go to Slack `#creditmate-alerts` and are handled in working hours.
- The PagerDuty service, schedule and escalation policy live outside this repository. Fill in the routing key through
  the secret store, and record the schedule link here once it exists: `REPLACE_ME_PAGERDUTY_SCHEDULE_URL`.

## Escalation (proposed)

1. Primary acknowledges and starts the incident.
2. No acknowledgement within the agreed window (proposed: 10 minutes): page secondary.
3. Customer-visible outage lasting longer than the agreed window (proposed: 30 minutes): notify the engineering lead.

## Alert-to-runbook map

| Alert | Runbook |
|---|---|
| CreditmateHighErrorRate, CreditmateEndpointErrorRateHigh | [high-error-rate.md](high-error-rate.md) |
| CreditmateHighLatencyP99, CreditmateEndpointLatencyP99High, CPU, saturation, HPA max | [high-latency.md](high-latency.md) |
| CreditmateNodeDiskUsage* | [disk-usage.md](disk-usage.md) |
| CreditmatePodCrashLooping, CreditmateDeploymentReplicasUnavailable | [rollback.md](rollback.md) if after a deploy |
| CreditmateTargetDown | this page: check the pod, then the exporter |
| CreditmateRedisDown, CreditmatePostgresDown, CreditmateElasticsearchRed | this page, dependency outage below |
| CreditmateNodeMemoryPressure | this page: check for OOM kills and memory-heavy pods |

## Dependency outage

Redis, Postgres and Elasticsearch are external managed services. Check the provider status page first.

- **Redis down:** sessions, cache and the Celery broker are affected. Celery tasks queue up and run later once Redis
  returns. Do not restart the backend to "fix" it.
- **Postgres down:** the site is down. Check connection limits (`max_connections`) and whether an application deploy
  opened many connections. Restarting the backend won't help a database outage.
- **Elasticsearch red:** search results are incomplete. Check unassigned shards. Search is degraded, not down.

## Communicate

- Proposed: status page update within 15 minutes of a confirmed customer-facing outage. Confirm the status page tool first.
- Incident notes in the incident channel. Keep a timeline with UTC times.

# Monitoring

Prometheus rules, Alertmanager routing, and the Grafana dashboard for staging and production.

```
monitoring/
├── health-checks.md                     # endpoints, probes, metric names, verification steps
├── prometheus/
│   ├── prometheus.yml                   # scrape jobs (static placeholders), rule_files, alerting
│   ├── rules/creditmate-recording.yml   # RED recording rules (per view and global)
│   ├── rules/creditmate-alerts.yml      # alerts: error rate, latency, USE, Kubernetes, dependencies
│   └── tests/creditmate-alerts_test.yml # promtool unit tests for the error-rate alerts
├── alertmanager/
│   └── alertmanager.yml.tmpl            # routing template: critical -> PagerDuty, warning -> Slack
└── grafana/
    └── dashboards/creditmate-overview.json  # RED / USE / dependencies / business rows
```

## Coverage against the task 8.4 acceptance criteria

| Requirement | Where |
|---|---|
| RED metrics per endpoint | `creditmate:http_*` recording rules; dashboard RED row |
| USE metrics for infrastructure | node_exporter and kube-state-metrics panels and alerts |
| Business metrics (comparisons, searches, signups) | dashboard row only; **backend counters not implemented** |
| Error rate > 1% | `CreditmateHighErrorRate` (critical), `CreditmateEndpointErrorRateHigh` (warning) |
| Latency p99 > 1s | `CreditmateHighLatencyP99`, `CreditmateEndpointLatencyP99High` |
| Disk > 80% | `CreditmateNodeDiskUsageHigh` (warning), `CreditmateNodeDiskUsageCritical` (> 90%) |
| On-call rotation (PagerDuty/Opsgenie) | routing in `alertmanager.yml.tmpl`; the schedule itself is not configured here |

## Validate

```bash
# Prometheus rules and config. Run inside prometheus/ because rule_files paths are relative.
(cd monitoring/prometheus && promtool check rules rules/creditmate-recording.yml rules/creditmate-alerts.yml \
  && promtool check config prometheus.yml \
  && promtool test rules tests/creditmate-alerts_test.yml)

# Alertmanager: render placeholders into a temp file, never commit the rendered output
sed -e 's#REPLACE_ME_SLACK_WEBHOOK_URL#https://hooks.slack.com/services/X/Y/Z#' \
    -e 's#REPLACE_ME_PAGERDUTY_ROUTING_KEY#<key>#' -e 's#REPLACE_ME_ENVIRONMENT#staging#' \
    monitoring/alertmanager/alertmanager.yml.tmpl > /tmp/alertmanager.yml
amtool check-config /tmp/alertmanager.yml
```

Dashboard JSON: `python3 -m json.tool grafana/dashboards/creditmate-overview.json > /dev/null`.

# Monitoring

Prometheus rules, Alertmanager routing, and the Grafana dashboard for staging and production.

```
monitoring/
├── health-checks.md                     # endpoints, probes, metric names, verification steps
├── prometheus/
│   ├── prometheus.yml                   # scrape jobs (static placeholders), rule_files, alerting
│   ├── rules/creditmate-recording.yml   # RED recording rules (per view and global)
│   ├── rules/creditmate-alerts.yml      # alerts: error rate, latency, USE, Kubernetes, dependencies
│   ├── rules/creditmate-data-quality.yml # extraction confidence / success-rate warnings (task 2.2)
│   ├── tests/creditmate-alerts_test.yml # promtool unit tests for the error-rate alerts
│   └── tests/creditmate-data-quality_test.yml # promtool unit tests for those warnings
├── alertmanager/
│   └── alertmanager.yml.tmpl            # routing template: critical -> PagerDuty, warning -> Slack
├── grafana/
│   └── dashboards/
│       ├── creditmate-overview.json     # RED / USE / dependencies / business rows
│       └── data-quality.json            # extraction quality, PostgreSQL datasource (task 2.2)
├── postgres-exporter/
│   └── data-quality-queries.yaml        # custom queries: dq_monitor views -> pg_dq_* metrics
├── sql/
│   ├── data_quality_views.sql           # read-only dq_monitor views + dq_reader role (Django-free)
│   ├── apply.sh                         # applies the views with psql
│   └── README.md                        # view reference, grants, validation
└── metabase/
    ├── 01..05_*.sql                     # Metabase questions over the same views
    └── README.md                        # setup and alert for the Metabase alternative
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
| Extraction confidence < 0.5, success rate < 70% (task 2.2) | `CreditmateDataQualityLow*` and `CreditmateBankDataQualityLow*` warnings; Grafana *Data Quality* dashboard; Metabase questions. Inputs come from the `dq_monitor` views, see `sql/README.md` |

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

Data quality (task 2.2):

```bash
# Rules and unit tests, run from monitoring/prometheus
(cd monitoring/prometheus && promtool check rules rules/creditmate-data-quality.yml \
  && promtool test rules tests/creditmate-data-quality_test.yml)

# Dashboard JSON
python3 -m json.tool grafana/dashboards/creditmate-overview.json > /dev/null
python3 -m json.tool grafana/dashboards/data-quality.json > /dev/null

# Views: apply to a scratch database first (see sql/README.md)
DQ_DATABASE_URL=... monitoring/sql/apply.sh
```

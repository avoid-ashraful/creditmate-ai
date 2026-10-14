# Metabase: data-quality questions

Metabase alternative to the Grafana dashboard in `monitoring/grafana/dashboards/data-quality.json`.
Both read the same `dq_monitor` views, so the numbers match. Use whichever tool the team already runs.

| File | Question | Suggested visualisation |
|---|---|---|
| `01_bank_success_rate.sql` | Per-bank extraction success rate | Table, `success_rate` coloured red below 0.7 |
| `02_missing_critical_fields.sql` | Missing `annual_fee` / `interest_rate_apr` per bank | Grouped bar chart, x = `bank_name` |
| `03_confidence_trend.sql` | Average confidence, last 30 days (daily, 7-day, 30-day) | Line chart, y from 0 to 1, reference line at 0.5 |
| `04_ocr_vs_text.sql` | OCR vs text vs unknown pipeline comparison | Table, or bar chart of `success_rate` |
| `05_active_alerts.sql` | Breached thresholds | Table; also the alert condition (see below) |

## Setup

1. Apply the views once, with `monitoring/sql/apply.sh` (see `monitoring/sql/README.md`).
2. Give Metabase a login that is a member of `dq_reader`. Do not point it at the application's own
   database user. Use a separate login.
3. In Metabase, add the database connection. Then create a **New > SQL query** question for each
   file and paste its contents in. Keep the `-- Question N` header comment, which says how the
   question is meant to be visualised.
4. Save the five questions into one collection, and arrange them on one dashboard.

## Alerts

Question 5 returns no rows when nothing is breached, and one row per breach otherwise.

- Open question 5, choose **Alert > Create alert**.
- Set the trigger to **When results exist**, with a schedule that matches the crawl cadence, daily
  is typical.
- Send it to the data-quality Slack channel, the same destination as the Prometheus warnings.

The Prometheus warnings (`monitoring/prometheus/rules/creditmate-data-quality.yml`) use the same
thresholds with a one-hour `for:` window. Metabase alerts check on a schedule, so expect them to fire
later than Prometheus.

## Keeping in step

The thresholds live in `dq_monitor.thresholds` and are repeated in the Grafana panel colours and in the
Prometheus rules. If you change one, change all of them, then update `CONFIDENCE_ALERT_THRESHOLD` and
`SUCCESS_RATE_ALERT_THRESHOLD` in `banks/services/quality_dashboard.py`.

# Data quality (extraction confidence and success rate)

**Alerts:** `CreditmateDataQualityLowConfidence` and `CreditmateDataQualityLowSuccessRate` (overall),
`CreditmateBankDataQualityLowConfidence` and `CreditmateBankDataQualityLowSuccessRate` (one bank).
All four are `warning`, routed to Slack. None of them pages. Thresholds: confidence below 0.5,
success rate below 70%, each held for 1 hour.

**Where to look:** Grafana dashboard *Creditmate Data Quality (Extraction)*, or the Metabase
questions in `monitoring/metabase/`. The staff JSON snapshot is at `/admin/data-quality/` (log in
as a staff user). Every surface reads the same numbers. If the alerts and the dashboard disagree,
the views in `monitoring/sql/data_quality_views.sql` are the place to check.

## 1. Scope it (5 minutes)

- Overall or one bank? Overall alerts mean every source is affected, which usually points at the
  pipeline (a deploy, the extraction provider, OCR). A single bank usually means that bank's sources.
- How much data sits under the number? Check `total_contents` and `scored_7d` for the bank. A success
  rate of 0% from two failed crawls is noise, not an incident. The rules have no minimum sample size, so
  this is the first thing to rule out.
- When did it start? The *Average extraction confidence* panel shows the daily trend. A step change on
  one day points at a release, a prompt change or a source change. A slow slide points at a site
  changing its layout.

Diagnostic queries (run them with an on-call read-only login, see the note below):

```sql
-- Recent failures for one bank, with the error the crawler stored
SELECT cc.id, cc.crawled_at, cc.extraction_method, left(cc.error_message, 200) AS error
FROM banks_crawledcontent AS cc
JOIN banks_bankdatasource AS ds ON ds.id = cc.data_source_id
JOIN banks_bank AS b ON b.id = ds.bank_id
WHERE b.name = 'REPLACE_ME_BANK_NAME'
  AND cc.processing_status = 'failed'
  AND cc.crawled_at >= now() - interval '7 days'
ORDER BY cc.crawled_at DESC
LIMIT 20;
```

The `dq_reader` role reads only the `dq_monitor` views. The queries in this runbook read the `banks_*` tables
directly, so run them with an on-call read-only login that has `SELECT` on those tables. Do not use the
application's login.

```sql
-- Sources that are close to being deactivated (5 failed attempts deactivates the source)
SELECT b.name AS bank_name, ds.url, ds.failed_attempt_count, ds.is_active, ds.last_crawled_at
FROM banks_bankdatasource AS ds
JOIN banks_bank AS b ON b.id = ds.bank_id
WHERE ds.failed_attempt_count > 0
ORDER BY ds.failed_attempt_count DESC, b.name;
```

## 2. Read the errors

- `error_message` on the failed rows (query above). Group them: HTTP 4xx or 5xx and timeouts point at the
  source. Provider errors (rate limits, timeouts) point at the LLM provider. OCR or PDF errors point at the
  extraction path.
- Errors in Sentry for the backend, filtered to `banks.` tasks and the crawl task names.
- Logs: `kubectl -n creditmate-prod logs deploy/creditmate-backend --since=24h | grep -i 'crawl\|extract' | tail -100`.

## 3. Decide

| Signal | Action |
|---|---|
| Failures for one bank, HTTP 404 or redirects | The bank moved its document. Update the `BankDataSource.url` in admin, or deactivate the source. Then recrawl (step 4). |
| Failures for one bank, timeouts | The source is slow or blocking. Retry later. If it persists, check whether the bank blocks the crawler's user agent. |
| Failures across banks, provider errors | Extraction provider outage or quota. Check the provider status page and the quota. New crawls succeed once the provider recovers, but the all-time rate recovers slowly (step 5). |
| Success rate low on `ocr` but normal on `text` (method panel) | OCR path problem. Check the OCR dependency and recent changes to `content_extractor.py`. |
| Confidence low, `Contents missing annual_fee` or `missing interest_rate_apr` high for one bank | The bank changed its fee layout, or the fees are in an image. Open the source and compare with the stored `extracted_content`. Rows with `needs_manual_review` are candidates for the review queue. |
| Confidence low across all banks, starting on one day | A release or a prompt change. Check `kubectl rollout history`, then [rollback.md](rollback.md) if the change is recent and the cause is clear. |
| `Cards with NULL annual_fee` high | Often a card whose fee the bank does not publish. Not an error unless the count grows after a crawl. |

Do not bulk-edit rows or `needs_manual_review` to move a number. The dashboard would then stop describing the
data. If a repair is needed, use the repair-script process with a dry run first.

## 4. Recover

Recrawl one bank or one source, with a dry run first. Each crawl calls the LLM provider, so do not loop over banks.

```bash
kubectl -n creditmate-prod exec deploy/creditmate-backend -- \
  python manage.py crawl_bank_data --bank-id <BANK_ID> --dry-run
kubectl -n creditmate-prod exec deploy/creditmate-backend -- \
  python manage.py crawl_bank_data --bank-id <BANK_ID>
```

Also available: `--source-id <SOURCE_ID>` for one source. The scheduled jobs refresh the data on their own:
`daily-crawl-all-active-banks` at 02:00 UTC, and `monthly-data-quality-check` every 30 days.

## 5. Close

- **Success-rate alerts recover slowly.** The success rate is all-time (`completed / (completed + failed)`
  over every crawled row), not a rolling window. A bank with a long history of failures needs many new
  successes before the rate passes 70%. To see the current state, compare the recent failures with the
  recent completions. Count failures and completions with the same `crawled_at >= now() - interval '7 days'` filter.
- **Confidence alerts lag.** The confidence used by the alert is the 7-day average, falling back to the
  30-day average only when the 7-day average is missing or exactly 0. A bad week keeps the 7-day average low
  for up to 7 days after the fix. That is expected. Do not start more repairs while it drains. Watch the
  *Trailing 7 days* line on the dashboard instead.
- Post in the data channel: the bank or the scope, the first bad day, the cause, and the action.
- Open a follow-up for any root cause not fixed yet, for example a source URL that needs updating across banks.

## Known limits

- No minimum sample size: small banks alert on a handful of rows.
- The success-rate alerts are all-time, so they lag real recovery (see step 5).
- Crawl-run status is not part of this data. "Last run failed" is not visible here. Use the crawl logs.
- The Grafana dashboard queries Postgres directly. The alerts reach Prometheus through postgres_exporter
  custom queries (`monitoring/postgres-exporter/data-quality-queries.yaml`). If the exporter is not
  configured with that file, the alerts stay silent, which is not the same as healthy. Check that the
  `pg_dq_*` series exist.

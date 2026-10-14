# Data-quality reporting views

`data_quality_views.sql` creates the `dq_monitor` schema: read-only aggregate views over the
crawler tables. The Grafana dashboard, the Metabase questions and the postgres_exporter alert
inputs all read these views, so every surface reports the same numbers as the staff JSON
snapshot at `/admin/data-quality/` (`banks/services/quality_dashboard.py`).

| View | Grain | Feeds |
|---|---|---|
| `dq_monitor.thresholds` | one row | alert thresholds (0.5 confidence, 0.7 success rate) |
| `dq_monitor.bank_quality` | one row per bank | per-bank table, missing-field chart, per-bank alerts |
| `dq_monitor.totals_quality` | one row | overall stats, overall alerts |
| `dq_monitor.method_quality` | three rows: `ocr`, `text`, `unknown` | OCR vs text comparison |
| `dq_monitor.confidence_daily` | one row per day, last 30 days | 7-day and 30-day confidence trend |
| `dq_monitor.alerts` | one row per breached rule | alert table, Metabase alert question |

The views read these base tables and columns (verified against the migrations):

- `banks_bank`: `id`, `name`, `is_active`
- `banks_bankdatasource`: `id`, `bank_id`
- `banks_crawledcontent`: `data_source_id`, `processing_status`, `extraction_confidence`,
  `extraction_method`, `missing_critical_fields` (jsonb), `crawled_at`
- `credit_cards_creditcard`: `bank_id`, `annual_fee`, `interest_rate_apr`

No view exposes `raw_content`, `extracted_content` or `parsed_json`.

## Apply without Django

Requires `psql` (PostgreSQL 13 or later) and an account that can create a schema and a role.

```bash
DQ_DATABASE_URL='postgresql://<admin_user>@<host>:5432/<database>' monitoring/sql/apply.sh
```

Put the password in `PGPASSWORD` or `~/.pgpass`, not in the URL. The script runs the file in one
transaction and stops on the first error. It is idempotent, so rerun it after any edit.

Or run `psql` directly:

```bash
psql "$DQ_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f monitoring/sql/data_quality_views.sql
```

The views are owned by the account that applies them. Readers therefore need only `SELECT` on
the views, not on the `banks_*` or `credit_cards_*` tables.

## Give a tool read access

The script creates the `NOLOGIN` role `dq_reader` with `USAGE` on the schema and `SELECT` on the
six objects. Attach it to the login role that each tool uses:

```sql
CREATE ROLE grafana_dq LOGIN PASSWORD '...';   -- or reuse an existing reporting login
GRANT dq_reader TO grafana_dq;
```

Use a separate login per tool (Grafana, Metabase, postgres_exporter) so each can be rotated on its own.
Keep `dq_reader` away from write privileges. Remove any `CREATE` privilege on the `dq_monitor` schema if one was granted.

## Validate

- Parse check: `psql ... -f monitoring/sql/data_quality_views.sql` on a scratch database.
- Parity check: the Python snapshot (`build_dashboard()`) and the views must agree on counts, rates and
  alerts. This was checked against a scratch database built from the backend migrations.
- Every Grafana panel query and every `monitoring/metabase/*.sql` file runs without error against the
  same database.

## Notes

- Rates are `NULL`, not `0`, when the denominator is empty. Rates are rounded to 4 decimals. The Python
  service uses banker's rounding on floats, so an exact tie such as `0.00005` can differ in the last digit.
- `latest_confidence` uses the 7-day average, but a 7-day average of exactly `0` falls back to the
  30-day average, matching Python's `avg_7d or avg_30d`.
- `confidence_daily` buckets by calendar day. Its last point covers `today-6 .. today` and can include a
  few hours more than the exact 7-day statistic.
- Missing-field checks match the name the scorer stores, `interest_rate_apr` (`CRITICAL_FIELDS` in
  `banks/services/quality_scoring.py`). The acceptance criteria say `interest_rate`, but no field by that
  name is written anywhere.

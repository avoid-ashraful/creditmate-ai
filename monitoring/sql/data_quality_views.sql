-- Read-only reporting views for the data-quality dashboard (task 2.2).
--
-- Mirrors banks/services/quality_dashboard.py so Grafana, Metabase and the
-- Prometheus exporter report the same numbers as /admin/data-quality/.
-- Every view is an aggregate: no raw_content, extracted_content or parsed_json
-- is exposed. Views run with the privileges of the account that applies this
-- file, so the reporting role needs no grants on the banks_* or credit_cards_*
-- tables themselves.
--
-- Source tables and columns (see banks/models.py, credit_cards/models.py):
--   banks_bank                 id, name, is_active
--   banks_bankdatasource       id, bank_id, is_active
--   banks_crawledcontent       data_source_id, credit_card_id, processing_status,
--                              extraction_confidence, extraction_method,
--                              missing_critical_fields (jsonb), crawled_at
--   credit_cards_creditcard    bank_id, annual_fee, interest_rate_apr
--
-- Apply without Django (idempotent; see monitoring/sql/README.md):
--   psql "$DQ_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f monitoring/sql/data_quality_views.sql

CREATE SCHEMA IF NOT EXISTS dq_monitor;

-- Alert thresholds, kept in one place. Must match CONFIDENCE_ALERT_THRESHOLD and
-- SUCCESS_RATE_ALERT_THRESHOLD in banks/services/quality_dashboard.py and the
-- expressions in monitoring/prometheus/rules/creditmate-data-quality-alerts.yml.
CREATE OR REPLACE VIEW dq_monitor.thresholds AS
SELECT
    0.5::double precision AS confidence_min,
    0.7::double precision AS success_rate_min;

-- Per-bank block. One row per bank, including banks with no content yet
-- (their rate columns are NULL, never 0).
--
-- latest_confidence follows the service's `avg_7d or avg_30d`: a 7-day average
-- of exactly 0 falls back to the 30-day average, as it does in Python.
CREATE OR REPLACE VIEW dq_monitor.bank_quality AS
WITH content AS (
    SELECT
        ds.bank_id,
        cc.processing_status,
        cc.extraction_confidence,
        cc.crawled_at,
        cc.missing_critical_fields
    FROM banks_crawledcontent AS cc
    JOIN banks_bankdatasource AS ds ON ds.id = cc.data_source_id
),
content_agg AS (
    SELECT
        bank_id,
        count(*) AS total_contents,
        count(*) FILTER (WHERE processing_status = 'completed') AS completed,
        count(*) FILTER (WHERE processing_status = 'failed') AS failed,
        count(*) FILTER (WHERE processing_status = 'pending') AS pending,
        count(*) FILTER (WHERE processing_status = 'processing') AS processing,
        avg(extraction_confidence) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '7 days'
        ) AS avg_7d,
        count(*) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '7 days'
        ) AS scored_7d,
        avg(extraction_confidence) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '30 days'
        ) AS avg_30d,
        count(*) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '30 days'
        ) AS scored_30d,
        count(*) FILTER (
            WHERE processing_status = 'completed'
              AND missing_critical_fields @> '["annual_fee"]'::jsonb
        ) AS content_missing_annual_fee,
        count(*) FILTER (
            WHERE processing_status = 'completed'
              AND missing_critical_fields @> '["interest_rate_apr"]'::jsonb
        ) AS content_missing_apr
    FROM content
    GROUP BY bank_id
),
source_agg AS (
    SELECT bank_id, count(*) AS data_sources
    FROM banks_bankdatasource
    GROUP BY bank_id
),
card_agg AS (
    SELECT
        bank_id,
        count(*) AS cards_total,
        count(*) FILTER (WHERE annual_fee IS NULL) AS cards_null_annual_fee,
        count(*) FILTER (WHERE interest_rate_apr IS NULL) AS cards_null_apr
    FROM credit_cards_creditcard
    GROUP BY bank_id
)
SELECT
    b.id AS bank_id,
    b.name AS bank_name,
    b.is_active,
    coalesce(s.data_sources, 0) AS data_sources,
    coalesce(c.total_contents, 0) AS total_contents,
    coalesce(c.completed, 0) AS completed,
    coalesce(c.failed, 0) AS failed,
    coalesce(c.pending, 0) AS pending,
    coalesce(c.processing, 0) AS processing,
    round((c.completed::numeric / nullif(c.completed + c.failed, 0)), 4)::double precision AS success_rate,
    round(c.avg_7d::numeric, 4)::double precision AS average_confidence_7d,
    round(c.avg_30d::numeric, 4)::double precision AS average_confidence_30d,
    coalesce(c.scored_7d, 0) AS scored_7d,
    coalesce(c.scored_30d, 0) AS scored_30d,
    round(coalesce(nullif(c.avg_7d, 0), c.avg_30d)::numeric, 4)::double precision AS latest_confidence,
    coalesce(c.content_missing_annual_fee, 0) AS content_missing_annual_fee,
    coalesce(c.content_missing_apr, 0) AS content_missing_apr,
    coalesce(k.cards_total, 0) AS cards_total,
    coalesce(k.cards_null_annual_fee, 0) AS cards_null_annual_fee,
    coalesce(k.cards_null_apr, 0) AS cards_null_apr
FROM banks_bank AS b
LEFT JOIN content_agg AS c ON c.bank_id = b.id
LEFT JOIN source_agg AS s ON s.bank_id = b.id
LEFT JOIN card_agg AS k ON k.bank_id = b.id;

-- Whole-system block: one row. Same metrics as bank_quality, computed over all
-- content (weighted by row, not an average of per-bank averages).
CREATE OR REPLACE VIEW dq_monitor.totals_quality AS
WITH content_agg AS (
    SELECT
        count(*) AS total_contents,
        count(*) FILTER (WHERE processing_status = 'completed') AS completed,
        count(*) FILTER (WHERE processing_status = 'failed') AS failed,
        count(*) FILTER (WHERE processing_status = 'pending') AS pending,
        count(*) FILTER (WHERE processing_status = 'processing') AS processing,
        avg(extraction_confidence) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '7 days'
        ) AS avg_7d,
        count(*) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '7 days'
        ) AS scored_7d,
        avg(extraction_confidence) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '30 days'
        ) AS avg_30d,
        count(*) FILTER (
            WHERE extraction_confidence IS NOT NULL
              AND crawled_at >= now() - interval '30 days'
        ) AS scored_30d,
        count(*) FILTER (
            WHERE processing_status = 'completed'
              AND missing_critical_fields @> '["annual_fee"]'::jsonb
        ) AS content_missing_annual_fee,
        count(*) FILTER (
            WHERE processing_status = 'completed'
              AND missing_critical_fields @> '["interest_rate_apr"]'::jsonb
        ) AS content_missing_apr
    FROM banks_crawledcontent
),
card_agg AS (
    SELECT
        count(*) FILTER (WHERE annual_fee IS NULL) AS cards_null_annual_fee,
        count(*) FILTER (WHERE interest_rate_apr IS NULL) AS cards_null_apr
    FROM credit_cards_creditcard
)
SELECT
    (SELECT count(*) FROM banks_bank) AS banks,
    (SELECT count(*) FROM banks_bankdatasource) AS data_sources,
    c.total_contents,
    c.completed,
    c.failed,
    c.pending,
    c.processing,
    round((c.completed::numeric / nullif(c.completed + c.failed, 0)), 4)::double precision AS success_rate,
    round(c.avg_7d::numeric, 4)::double precision AS average_confidence_7d,
    round(c.avg_30d::numeric, 4)::double precision AS average_confidence_30d,
    c.scored_7d,
    c.scored_30d,
    round(coalesce(nullif(c.avg_7d, 0), c.avg_30d)::numeric, 4)::double precision AS latest_confidence,
    c.content_missing_annual_fee,
    c.content_missing_apr,
    k.cards_null_annual_fee,
    k.cards_null_apr
FROM content_agg AS c
CROSS JOIN card_agg AS k;

-- OCR vs text comparison. Always three rows (ocr, text, unknown) so panels do
-- not change shape when a bucket is empty. Rates are NULL when the denominator
-- is zero.
CREATE OR REPLACE VIEW dq_monitor.method_quality AS
WITH buckets (bucket) AS (
    VALUES ('ocr'), ('text'), ('unknown')
),
classified AS (
    SELECT
        CASE
            WHEN extraction_method IN ('ocr', 'image_ocr') THEN 'ocr'
            WHEN extraction_method IN ('pdf_text', 'webpage', 'csv') THEN 'text'
            ELSE 'unknown'
        END AS bucket,
        processing_status
    FROM banks_crawledcontent
),
counts AS (
    SELECT
        bucket,
        count(*) AS total_contents,
        count(*) FILTER (WHERE processing_status = 'completed') AS completed,
        count(*) FILTER (WHERE processing_status = 'failed') AS failed,
        count(*) FILTER (WHERE processing_status = 'pending') AS pending,
        count(*) FILTER (WHERE processing_status = 'processing') AS processing
    FROM classified
    GROUP BY bucket
)
SELECT
    b.bucket,
    coalesce(c.total_contents, 0) AS total_contents,
    coalesce(c.completed, 0) AS completed,
    coalesce(c.failed, 0) AS failed,
    coalesce(c.pending, 0) AS pending,
    coalesce(c.processing, 0) AS processing,
    CASE
        WHEN coalesce(c.total_contents, 0) > 0
            THEN round((c.completed::numeric / c.total_contents), 4)::double precision
    END AS completion_rate,
    round((c.completed::numeric / nullif(c.completed + c.failed, 0)), 4)::double precision AS success_rate
FROM buckets AS b
LEFT JOIN counts AS c ON c.bucket = b.bucket;

-- Daily confidence trend for the last 30 calendar days (one row per day, NULL
-- when a day has no scored content). The 7-day and 30-day columns are trailing
-- windows that end at the end of each day. The rightmost point can include a
-- few hours more than the exact 7-day stat in bank_quality/totals_quality,
-- because day buckets are aligned to midnight.
CREATE OR REPLACE VIEW dq_monitor.confidence_daily AS
WITH days AS (
    SELECT generate_series(
        date_trunc('day', now()) - interval '29 days',
        date_trunc('day', now()),
        interval '1 day'
    ) AS day
)
SELECT
    d.day AS time,
    (
        SELECT count(*)
        FROM banks_crawledcontent AS cc
        WHERE cc.extraction_confidence IS NOT NULL
          AND cc.crawled_at >= d.day
          AND cc.crawled_at < d.day + interval '1 day'
    ) AS scored_count,
    (
        SELECT round(avg(cc.extraction_confidence)::numeric, 4)::double precision
        FROM banks_crawledcontent AS cc
        WHERE cc.extraction_confidence IS NOT NULL
          AND cc.crawled_at >= d.day
          AND cc.crawled_at < d.day + interval '1 day'
    ) AS avg_confidence_daily,
    (
        SELECT round(avg(cc.extraction_confidence)::numeric, 4)::double precision
        FROM banks_crawledcontent AS cc
        WHERE cc.extraction_confidence IS NOT NULL
          AND cc.crawled_at >= d.day - interval '6 days'
          AND cc.crawled_at < d.day + interval '1 day'
    ) AS avg_confidence_7d,
    (
        SELECT round(avg(cc.extraction_confidence)::numeric, 4)::double precision
        FROM banks_crawledcontent AS cc
        WHERE cc.extraction_confidence IS NOT NULL
          AND cc.crawled_at >= d.day - interval '29 days'
          AND cc.crawled_at < d.day + interval '1 day'
    ) AS avg_confidence_30d
FROM days AS d;

-- Alerts, mirroring build_alerts(): a row per breached rule. Empty result means
-- nothing is breached. A NULL metric never produces a row.
CREATE OR REPLACE VIEW dq_monitor.alerts AS
SELECT
    'overall'::text AS scope,
    NULL::bigint AS bank_id,
    NULL::text AS bank_name,
    'low_confidence'::text AS kind,
    t.latest_confidence AS value,
    th.confidence_min AS threshold
FROM dq_monitor.totals_quality AS t
CROSS JOIN dq_monitor.thresholds AS th
WHERE t.latest_confidence IS NOT NULL AND t.latest_confidence < th.confidence_min
UNION ALL
SELECT
    'overall',
    NULL,
    NULL,
    'low_success_rate',
    t.success_rate,
    th.success_rate_min
FROM dq_monitor.totals_quality AS t
CROSS JOIN dq_monitor.thresholds AS th
WHERE t.success_rate IS NOT NULL AND t.success_rate < th.success_rate_min
UNION ALL
SELECT
    'bank',
    b.bank_id,
    b.bank_name::text,
    'low_confidence',
    b.latest_confidence,
    th.confidence_min
FROM dq_monitor.bank_quality AS b
CROSS JOIN dq_monitor.thresholds AS th
WHERE b.latest_confidence IS NOT NULL AND b.latest_confidence < th.confidence_min
UNION ALL
SELECT
    'bank',
    b.bank_id,
    b.bank_name::text,
    'low_success_rate',
    b.success_rate,
    th.success_rate_min
FROM dq_monitor.bank_quality AS b
CROSS JOIN dq_monitor.thresholds AS th
WHERE b.success_rate IS NOT NULL AND b.success_rate < th.success_rate_min;

-- Read-only role for Grafana, Metabase and postgres_exporter. NOLOGIN: attach it
-- to the login role each tool uses (GRANT dq_reader TO <login_role>).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dq_reader') THEN
        CREATE ROLE dq_reader NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA dq_monitor TO dq_reader;
GRANT SELECT ON dq_monitor.thresholds,
                dq_monitor.bank_quality,
                dq_monitor.totals_quality,
                dq_monitor.method_quality,
                dq_monitor.confidence_daily,
                dq_monitor.alerts
    TO dq_reader;

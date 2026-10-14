-- Question 3: average extraction confidence, last 30 days (7-day and 30-day trailing).
-- Visualization: line chart, x = time, y in [0, 1]. Trailing values are calendar-day aligned.
SELECT time,
       avg_confidence_daily AS "Daily average",
       avg_confidence_7d    AS "Trailing 7 days",
       avg_confidence_30d   AS "Trailing 30 days"
FROM dq_monitor.confidence_daily
ORDER BY time;

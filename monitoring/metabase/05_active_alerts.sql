-- Question 5: breached thresholds (confidence < 0.5, success rate < 0.7).
-- Returns one row per breach and no rows when everything is healthy, so it works as
-- a Metabase alert condition ("send when results exist").
SELECT scope,
       bank_name,
       kind,
       value,
       threshold
FROM dq_monitor.alerts
ORDER BY scope, bank_name, kind;

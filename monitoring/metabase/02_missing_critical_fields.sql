-- Question 2: missing critical fields (annual_fee, interest_rate_apr) per bank.
-- "Contents" counts completed crawled rows whose missing_critical_fields names the field.
-- "Cards" counts credit_cards_creditcard rows with a NULL column.
-- Visualization: grouped bar chart, x = bank_name.
SELECT bank_name,
       content_missing_annual_fee AS "Contents missing annual_fee",
       content_missing_apr        AS "Contents missing interest_rate_apr",
       cards_null_annual_fee      AS "Cards with NULL annual_fee",
       cards_null_apr             AS "Cards with NULL interest_rate_apr"
FROM dq_monitor.bank_quality
ORDER BY bank_name;

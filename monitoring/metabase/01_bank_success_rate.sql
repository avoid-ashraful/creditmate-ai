-- Question 1: per-bank extraction success rate.
-- Visualization: table, success_rate column coloured red below 0.7.
-- Blank rate means the bank has no completed or failed content yet, not 0%.
SELECT bank_name,
       data_sources,
       total_contents,
       completed,
       failed,
       pending,
       processing,
       success_rate
FROM dq_monitor.bank_quality
ORDER BY bank_name;

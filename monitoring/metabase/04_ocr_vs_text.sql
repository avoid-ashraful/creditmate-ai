-- Question 4: OCR vs text extraction comparison.
-- ocr = ocr + image_ocr; text = pdf_text + webpage + csv; unknown = anything else (including blank).
-- Visualization: table, or a bar chart of success_rate by bucket.
SELECT bucket,
       total_contents,
       completed,
       failed,
       pending,
       processing,
       completion_rate,
       success_rate
FROM dq_monitor.method_quality
ORDER BY bucket;

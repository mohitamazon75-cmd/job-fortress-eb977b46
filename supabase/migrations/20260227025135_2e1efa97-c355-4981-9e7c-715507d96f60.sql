-- Fix 5: Add feedback_flag column to scans table
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS feedback_flag TEXT DEFAULT NULL;

-- Create view to aggregate feedback accuracy by job family
CREATE OR REPLACE VIEW public.scan_accuracy_by_family AS
SELECT
  s.role_detected AS job_family,
  s.industry,
  COUNT(sf.id) AS feedback_count,
  AVG(sf.accuracy_rating) AS avg_accuracy,
  AVG(sf.relevance_rating) AS avg_relevance,
  COUNT(CASE WHEN sf.accuracy_rating <= 2 THEN 1 END) AS low_accuracy_count
FROM public.scans s
JOIN public.scan_feedback sf ON sf.scan_id = s.id
WHERE sf.accuracy_rating IS NOT NULL
GROUP BY s.role_detected, s.industry
HAVING COUNT(sf.id) >= 2
ORDER BY avg_accuracy ASC;
-- Fix the security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.scan_accuracy_by_family;
CREATE VIEW public.scan_accuracy_by_family WITH (security_invoker = true) AS
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
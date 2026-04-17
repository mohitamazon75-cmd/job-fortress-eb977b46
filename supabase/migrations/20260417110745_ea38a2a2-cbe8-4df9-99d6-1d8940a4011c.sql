-- One-time cleanup of contaminated state from the lazy-role bug
DELETE FROM public.model_b_results WHERE card_data IS NULL AND updated_at < now() - interval '5 minutes';

UPDATE public.scans
SET role_detected = NULL,
    final_json_report = NULL,
    scan_status = 'pending'
WHERE role_detected IS NOT NULL
  AND industry IS NOT NULL
  AND lower(trim(role_detected)) = lower(trim(industry)) || ' professional';
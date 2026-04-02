
-- Fix search_path on 5 public functions to prevent schema injection
ALTER FUNCTION public.update_diagnostic_results_updated_at() SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
-- Also fix check_error_threshold which is a trigger function
ALTER FUNCTION public.check_error_threshold() SET search_path = public;

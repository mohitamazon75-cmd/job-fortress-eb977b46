
-- Fix: Add RLS to scan_accuracy_by_family view
ALTER VIEW public.scan_accuracy_by_family SET (security_invoker = on);

-- Note: scan_accuracy_by_family is a VIEW, so we enable RLS via security_invoker
-- This ensures it respects the caller's permissions on underlying tables

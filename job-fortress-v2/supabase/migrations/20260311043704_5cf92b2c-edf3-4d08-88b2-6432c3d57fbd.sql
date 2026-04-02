
-- Attach trigger: apply_feedback_to_kg on scan_feedback INSERT
CREATE TRIGGER on_scan_feedback_inserted
  AFTER INSERT ON public.scan_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_feedback_to_kg();

-- Attach trigger: check_error_threshold on edge_function_logs INSERT
CREATE TRIGGER on_edge_function_log_inserted
  AFTER INSERT ON public.edge_function_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_error_threshold();

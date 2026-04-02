
CREATE INDEX IF NOT EXISTS idx_assessments_child_id_type ON public.assessments(child_id, type);
CREATE INDEX IF NOT EXISTS idx_reports_child_id_created_at ON public.reports(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports(token);

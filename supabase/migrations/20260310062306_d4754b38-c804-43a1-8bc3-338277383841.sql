-- Sprint 22: Email nurture tracking table
-- Tracks which nudge emails have been sent per user to prevent duplicates

CREATE TABLE public.email_nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nudge_type text NOT NULL,            -- 'd3_no_assessment' | 'd7_no_report'
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  email text NOT NULL,
  UNIQUE (user_id, nudge_type)         -- one of each type per user
);

CREATE INDEX idx_email_nudges_user ON public.email_nudges(user_id);

ALTER TABLE public.email_nudges ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access — only the service-role edge function writes here
CREATE POLICY "No direct client access to email_nudges"
  ON public.email_nudges
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
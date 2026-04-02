CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  uses_remaining integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access" ON public.invite_codes
  FOR ALL TO anon, authenticated USING (false);

INSERT INTO public.invite_codes (code, is_active) VALUES ('AI2026', true);

-- Add neurodivergence and wellbeing_consent columns to children table
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS neurodivergence text[] DEFAULT '{}';
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS wellbeing_consent boolean DEFAULT false;

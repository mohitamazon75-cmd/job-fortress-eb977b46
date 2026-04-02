-- Phase C: Defense plan milestone tracking
CREATE TABLE IF NOT EXISTS public.defense_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  milestone_key text NOT NULL,
  milestone_label text NOT NULL,
  resource_url text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, scan_id, milestone_key)
);

ALTER TABLE public.defense_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own milestones" ON public.defense_milestones
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_defense_milestones_user
  ON public.defense_milestones(user_id, scan_id);

CREATE INDEX IF NOT EXISTS idx_defense_milestones_incomplete
  ON public.defense_milestones(user_id, completed_at)
  WHERE completed_at IS NULL;

-- Phase C: Learning resources reference table
CREATE TABLE IF NOT EXISTS public.learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  estimated_hours numeric(4,1),
  platform text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.learning_resources TO authenticated, anon;

-- Seed with initial resources
INSERT INTO public.learning_resources (skill_category, title, url, estimated_hours, platform) VALUES
  ('cursor_ai', 'Cursor AI Getting Started', 'https://cursor.sh/docs/get-started', 3.0, 'Official Docs'),
  ('cursor_ai', 'Cursor AI Complete Course', 'https://www.youtube.com/watch?v=gqUQbjsYZLQ', 5.0, 'YouTube'),
  ('python_ml', 'Python for Data Science', 'https://www.coursera.org/learn/python-for-applied-data-science-ai', 20.0, 'Coursera'),
  ('python_ml', 'Practical Machine Learning', 'https://www.fast.ai', 40.0, 'fast.ai'),
  ('prompt_engineering', 'Prompt Engineering Guide', 'https://www.promptingguide.ai', 8.0, 'Official Docs'),
  ('prompt_engineering', 'ChatGPT Prompt Engineering for Developers', 'https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/', 4.0, 'DeepLearning.AI'),
  ('data_visualization', 'Tableau for Beginners', 'https://www.coursera.org/learn/analytics-tableau', 15.0, 'Coursera'),
  ('data_visualization', 'Power BI Fundamentals', 'https://learn.microsoft.com/en-us/training/paths/create-use-analytics-reports-power-bi/', 10.0, 'Microsoft Learn'),
  ('communication', 'Business Communication Skills', 'https://www.coursera.org/learn/wharton-communication-skills', 12.0, 'Coursera'),
  ('leadership', 'Leadership and Management', 'https://www.coursera.org/learn/leadership-management', 16.0, 'Coursera'),
  ('sql', 'Advanced SQL for Data Analysis', 'https://mode.com/sql-tutorial/', 8.0, 'Mode Analytics'),
  ('linkedin_optimization', 'LinkedIn Profile Optimization', 'https://www.linkedin.com/learning/linkedin-profile-optimization', 2.0, 'LinkedIn Learning'),
  ('ai_tools_general', 'AI for Everyone', 'https://www.deeplearning.ai/courses/ai-for-everyone/', 6.0, 'DeepLearning.AI'),
  ('excel_advanced', 'Excel Skills for Business', 'https://www.coursera.org/specializations/excel', 20.0, 'Coursera');

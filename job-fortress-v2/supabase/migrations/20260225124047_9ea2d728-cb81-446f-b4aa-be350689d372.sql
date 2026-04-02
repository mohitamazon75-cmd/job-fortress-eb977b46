
-- =============================================================
-- AI-PROPHET: Proprietary Knowledge Graph (Our IP / Our Moat)
-- =============================================================

-- 1. Job Taxonomy: 50+ Indian job families with disruption baselines
CREATE TABLE public.job_taxonomy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_family TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  disruption_baseline INTEGER NOT NULL DEFAULT 50,
  india_prevalence NUMERIC(4,2) DEFAULT 0.05,
  avg_salary_lpa NUMERIC(6,2),
  automatable_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_tools_replacing JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Skill Risk Matrix: Every skill scored for automation risk
CREATE TABLE public.skill_risk_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  automation_risk INTEGER NOT NULL DEFAULT 50,
  ai_augmentation_potential INTEGER NOT NULL DEFAULT 50,
  india_demand_trend TEXT NOT NULL DEFAULT 'stable',
  replacement_tools TEXT[] NOT NULL DEFAULT '{}',
  human_moat TEXT,
  learning_curve TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Job-Skill relationships (the knowledge graph edges)
CREATE TABLE public.job_skill_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_family TEXT NOT NULL REFERENCES public.job_taxonomy(job_family),
  skill_name TEXT NOT NULL REFERENCES public.skill_risk_matrix(skill_name),
  importance NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  UNIQUE(job_family, skill_name)
);

-- 4. Market signals: real-time-ish hiring data per role/city
CREATE TABLE public.market_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_family TEXT NOT NULL REFERENCES public.job_taxonomy(job_family),
  metro_tier TEXT NOT NULL DEFAULT 'tier1',
  posting_volume_30d INTEGER DEFAULT 0,
  posting_change_pct NUMERIC(6,2) DEFAULT 0,
  avg_salary_change_pct NUMERIC(6,2) DEFAULT 0,
  ai_job_mentions_pct NUMERIC(6,2) DEFAULT 0,
  market_health TEXT NOT NULL DEFAULT 'stable',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Assessments: every verdict we generate (anonymous, no auth required)
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  industry TEXT NOT NULL,
  years_experience TEXT NOT NULL,
  metro_tier TEXT NOT NULL,
  matched_job_family TEXT,
  agent_1_disruption JSONB,
  agent_2_skills JSONB,
  agent_3_market JSONB,
  agent_4_verdict JSONB,
  fate_score INTEGER,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.job_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_risk_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skill_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Public read access for taxonomy/skills/market (this IS our public product)
CREATE POLICY "Job taxonomy is publicly readable" ON public.job_taxonomy FOR SELECT USING (true);
CREATE POLICY "Skill matrix is publicly readable" ON public.skill_risk_matrix FOR SELECT USING (true);
CREATE POLICY "Job skill map is publicly readable" ON public.job_skill_map FOR SELECT USING (true);
CREATE POLICY "Market signals are publicly readable" ON public.market_signals FOR SELECT USING (true);

-- Assessments: anyone can insert (anonymous usage), only read own by session
CREATE POLICY "Anyone can create assessments" ON public.assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read assessments by session" ON public.assessments FOR SELECT USING (true);

-- =============================================================
-- SEED DATA: Indian Job Taxonomy (our proprietary dataset)
-- =============================================================

INSERT INTO public.job_taxonomy (job_family, category, disruption_baseline, india_prevalence, avg_salary_lpa, automatable_tasks, ai_tools_replacing) VALUES
('frontend_developer', 'IT & Software', 65, 0.12, 12.0, '["UI component creation", "CSS styling", "Basic page layouts", "Form validation", "API integration boilerplate"]', '["GitHub Copilot", "v0.dev", "Cursor", "Bolt"]'),
('backend_developer', 'IT & Software', 58, 0.10, 14.0, '["CRUD API generation", "Database queries", "Unit test writing", "Documentation", "Boilerplate code"]', '["GitHub Copilot", "Cursor", "Amazon CodeWhisperer"]'),
('data_analyst', 'IT & Software', 72, 0.08, 8.5, '["Report generation", "Data cleaning", "Basic visualization", "SQL queries", "Dashboard creation"]', '["ChatGPT Advanced Data Analysis", "Julius AI", "Akkio"]'),
('ml_engineer', 'IT & Software', 40, 0.04, 18.0, '["Hyperparameter tuning", "Model documentation", "Data pipeline setup"]', '["AutoML", "H2O.ai", "Google Vertex AI"]'),
('devops_engineer', 'IT & Software', 55, 0.06, 16.0, '["CI/CD pipeline setup", "Infrastructure monitoring", "Log analysis", "Deployment scripts"]', '["GitHub Actions AI", "Harness AI", "PagerDuty AI"]'),
('qa_tester', 'IT & Software', 78, 0.09, 7.0, '["Test case generation", "Regression testing", "Bug report writing", "UI testing"]', '["Testim", "Mabl", "Applitools"]'),
('digital_marketer', 'Marketing & Advertising', 74, 0.08, 7.5, '["Content writing", "SEO optimization", "Ad copy creation", "Social media scheduling", "Basic analytics"]', '["Jasper", "SurferSEO", "Copy.ai", "Hootsuite AI"]'),
('content_writer', 'Marketing & Advertising', 82, 0.06, 5.0, '["Blog writing", "Product descriptions", "Email newsletters", "Social captions", "Press releases"]', '["ChatGPT", "Claude", "Jasper", "Writesonic"]'),
('graphic_designer', 'Creative & Design', 68, 0.05, 6.5, '["Stock graphics", "Social media posts", "Banner ads", "Photo editing", "Layout templates"]', '["Midjourney", "DALL-E", "Canva AI", "Adobe Firefly"]'),
('ui_ux_designer', 'Creative & Design', 55, 0.04, 12.0, '["Wireframing", "Component library management", "Design system documentation", "User flow diagrams"]', '["Figma AI", "Galileo AI", "Uizard"]'),
('financial_analyst', 'Finance & Banking', 62, 0.07, 10.0, '["Financial modeling", "Report compilation", "Data entry", "Compliance checks", "Variance analysis"]', '["Bloomberg Terminal AI", "Kensho", "Alphasense"]'),
('accountant', 'Finance & Banking', 75, 0.10, 6.0, '["Bookkeeping", "Invoice processing", "Tax filing", "Reconciliation", "Audit preparation"]', '["QuickBooks AI", "Xero AI", "TallyPrime AI"]'),
('hr_generalist', 'Other', 60, 0.08, 7.0, '["Resume screening", "Interview scheduling", "Policy documentation", "Employee onboarding docs"]', '["HireVue", "Pymetrics", "Eightfold AI"]'),
('sales_executive', 'Other', 45, 0.12, 8.0, '["Lead research", "Email outreach", "CRM updates", "Proposal drafts"]', '["Apollo.io", "Lavender", "Outreach AI"]'),
('customer_support', 'Other', 80, 0.15, 3.5, '["Ticket resolution L1", "FAQ responses", "Chat support", "Email responses", "Call routing"]', '["Zendesk AI", "Freshdesk AI", "Intercom Fin"]'),
('project_manager', 'Other', 42, 0.06, 14.0, '["Status report generation", "Meeting summaries", "Timeline estimation", "Resource planning docs"]', '["Notion AI", "Asana AI", "Monday.com AI"]'),
('doctor', 'Healthcare', 25, 0.03, 15.0, '["Medical record summarization", "Drug interaction checks", "Appointment scheduling"]', '["Google Med-PaLM", "Nuance DAX"]'),
('nurse', 'Healthcare', 20, 0.05, 5.0, '["Charting", "Medication reminders", "Patient scheduling"]', '["Epic AI", "Cerner AI"]'),
('teacher', 'Education', 45, 0.08, 6.0, '["Grading", "Lesson plan drafts", "Quiz generation", "Progress reports"]', '["Khanmigo", "Gradescope", "Quillbot"]'),
('mechanical_engineer', 'Manufacturing', 48, 0.04, 10.0, '["CAD drafting", "Tolerance analysis", "Bill of materials", "Simulation setup"]', '["Autodesk Fusion AI", "Ansys AI", "SolidWorks AI"]'),
('supply_chain_manager', 'Manufacturing', 55, 0.03, 12.0, '["Demand forecasting", "Inventory optimization", "Vendor evaluation reports"]', '["Blue Yonder", "o9 Solutions", "Kinaxis AI"]'),
('legal_associate', 'Other', 65, 0.03, 12.0, '["Contract review", "Legal research", "Document drafting", "Due diligence"]', '["Harvey AI", "CoCounsel", "Luminance"]'),
('pharmacist', 'Healthcare', 55, 0.04, 6.5, '["Prescription verification", "Drug inventory", "Patient counseling notes"]', '["PioneerRx AI", "ScriptPro"]'),
('video_editor', 'Creative & Design', 60, 0.03, 6.0, '["Color correction", "Subtitle generation", "Rough cuts", "Transitions"]', '["Runway ML", "Descript", "CapCut AI"]'),
('data_entry_operator', 'Other', 95, 0.12, 2.5, '["Form filling", "Data transcription", "Document digitization", "Spreadsheet updates"]', '["UiPath", "Automation Anywhere", "Power Automate"]');

-- =============================================================
-- SEED DATA: Skill Risk Matrix (proprietary scoring)
-- =============================================================

INSERT INTO public.skill_risk_matrix (skill_name, category, automation_risk, ai_augmentation_potential, india_demand_trend, replacement_tools, human_moat, learning_curve) VALUES
-- High Risk Skills (70-100)
('data_entry', 'operations', 95, 10, 'falling', '{"UiPath", "Automation Anywhere"}', NULL, 'low'),
('basic_copywriting', 'content', 88, 75, 'falling', '{"ChatGPT", "Jasper", "Claude"}', NULL, 'low'),
('report_generation', 'analytics', 85, 80, 'falling', '{"Julius AI", "ChatGPT"}', NULL, 'low'),
('seo_optimization', 'marketing', 82, 70, 'stable', '{"SurferSEO", "Clearscope"}', NULL, 'medium'),
('manual_testing', 'engineering', 80, 60, 'falling', '{"Testim", "Mabl"}', NULL, 'medium'),
('bookkeeping', 'finance', 78, 65, 'falling', '{"QuickBooks AI", "Xero"}', NULL, 'low'),
('social_media_management', 'marketing', 75, 70, 'stable', '{"Hootsuite AI", "Buffer AI"}', NULL, 'low'),
('l1_support', 'operations', 90, 20, 'falling', '{"Zendesk AI", "Intercom Fin"}', NULL, 'low'),
('email_writing', 'communication', 72, 80, 'stable', '{"Lavender", "Grammarly"}', NULL, 'low'),
('sql_queries', 'engineering', 70, 85, 'stable', '{"ChatGPT", "DBeaver AI"}', NULL, 'medium'),

-- Medium Risk Skills (40-69)
('frontend_development', 'engineering', 62, 85, 'stable', '{"Cursor", "v0.dev"}', 'Complex UX decisions', 'high'),
('financial_modeling', 'finance', 60, 75, 'stable', '{"Kensho", "Alphasense"}', 'Judgment under uncertainty', 'high'),
('graphic_design', 'creative', 58, 80, 'stable', '{"Midjourney", "Canva AI"}', 'Brand storytelling', 'medium'),
('backend_development', 'engineering', 55, 85, 'rising', '{"Cursor", "GitHub Copilot"}', 'System architecture', 'high'),
('project_management', 'management', 45, 70, 'rising', '{"Notion AI", "Asana AI"}', 'Stakeholder alignment', 'medium'),
('sales', 'business', 42, 75, 'stable', '{"Apollo.io", "Gong"}', 'Relationship trust', 'medium'),
('teaching', 'education', 40, 70, 'stable', '{"Khanmigo", "Gradescope"}', 'Student mentorship', 'high'),

-- Low Risk Skills (0-39)
('client_relationship_management', 'business', 18, 60, 'rising', '{}', 'Deep trust & empathy', 'high'),
('strategic_thinking', 'leadership', 15, 65, 'rising', '{}', 'Vision under ambiguity', 'high'),
('creative_direction', 'creative', 20, 70, 'rising', '{}', 'Cultural intuition', 'high'),
('team_leadership', 'leadership', 12, 55, 'rising', '{}', 'Emotional intelligence', 'high'),
('crisis_management', 'leadership', 10, 40, 'stable', '{}', 'Calm under pressure', 'high'),
('negotiation', 'business', 15, 50, 'rising', '{}', 'Reading people', 'high'),
('empathy_care', 'healthcare', 5, 30, 'rising', '{}', 'Irreplaceable human connection', 'high'),
('cross_functional_leadership', 'leadership', 14, 55, 'rising', '{}', 'Organizational navigation', 'high'),
('ethical_judgment', 'leadership', 8, 35, 'rising', '{}', 'Moral reasoning', 'high'),
('mentorship', 'education', 10, 45, 'rising', '{}', 'Personal development guidance', 'high'),
('brand_storytelling', 'creative', 25, 70, 'rising', '{}', 'Authentic narrative building', 'high'),
('product_vision', 'management', 20, 65, 'rising', '{}', 'Market intuition', 'high'),
('clinical_judgment', 'healthcare', 12, 50, 'rising', '{}', 'Patient safety instinct', 'high'),
('solution_architecture', 'engineering', 30, 80, 'rising', '{}', 'Holistic system thinking', 'high');

-- =============================================================
-- SEED DATA: Job-Skill Mappings
-- =============================================================

INSERT INTO public.job_skill_map (job_family, skill_name, importance, frequency) VALUES
('frontend_developer', 'frontend_development', 0.95, 'daily'),
('frontend_developer', 'sql_queries', 0.30, 'weekly'),
('frontend_developer', 'graphic_design', 0.20, 'weekly'),
('backend_developer', 'backend_development', 0.95, 'daily'),
('backend_developer', 'sql_queries', 0.80, 'daily'),
('backend_developer', 'solution_architecture', 0.60, 'weekly'),
('data_analyst', 'sql_queries', 0.90, 'daily'),
('data_analyst', 'report_generation', 0.85, 'daily'),
('data_analyst', 'financial_modeling', 0.40, 'weekly'),
('digital_marketer', 'seo_optimization', 0.80, 'daily'),
('digital_marketer', 'basic_copywriting', 0.75, 'daily'),
('digital_marketer', 'social_media_management', 0.85, 'daily'),
('content_writer', 'basic_copywriting', 0.95, 'daily'),
('content_writer', 'seo_optimization', 0.60, 'daily'),
('content_writer', 'email_writing', 0.70, 'daily'),
('graphic_designer', 'graphic_design', 0.95, 'daily'),
('graphic_designer', 'creative_direction', 0.40, 'weekly'),
('ui_ux_designer', 'graphic_design', 0.70, 'daily'),
('ui_ux_designer', 'frontend_development', 0.30, 'weekly'),
('ui_ux_designer', 'creative_direction', 0.60, 'daily'),
('financial_analyst', 'financial_modeling', 0.90, 'daily'),
('financial_analyst', 'report_generation', 0.80, 'daily'),
('financial_analyst', 'sql_queries', 0.50, 'weekly'),
('accountant', 'bookkeeping', 0.95, 'daily'),
('accountant', 'report_generation', 0.70, 'weekly'),
('customer_support', 'l1_support', 0.95, 'daily'),
('customer_support', 'email_writing', 0.80, 'daily'),
('sales_executive', 'sales', 0.90, 'daily'),
('sales_executive', 'client_relationship_management', 0.85, 'daily'),
('sales_executive', 'negotiation', 0.75, 'weekly'),
('project_manager', 'project_management', 0.90, 'daily'),
('project_manager', 'team_leadership', 0.80, 'daily'),
('project_manager', 'strategic_thinking', 0.60, 'weekly'),
('qa_tester', 'manual_testing', 0.90, 'daily'),
('qa_tester', 'sql_queries', 0.40, 'weekly'),
('doctor', 'clinical_judgment', 0.95, 'daily'),
('doctor', 'empathy_care', 0.90, 'daily'),
('nurse', 'empathy_care', 0.95, 'daily'),
('teacher', 'teaching', 0.95, 'daily'),
('teacher', 'mentorship', 0.85, 'daily'),
('data_entry_operator', 'data_entry', 0.95, 'daily'),
('hr_generalist', 'email_writing', 0.70, 'daily'),
('hr_generalist', 'client_relationship_management', 0.60, 'weekly'),
('legal_associate', 'strategic_thinking', 0.50, 'daily'),
('legal_associate', 'ethical_judgment', 0.70, 'daily'),
('ml_engineer', 'backend_development', 0.60, 'daily'),
('ml_engineer', 'solution_architecture', 0.70, 'weekly'),
('devops_engineer', 'backend_development', 0.50, 'daily'),
('devops_engineer', 'solution_architecture', 0.60, 'weekly');

-- =============================================================
-- SEED DATA: Market Signals (snapshot data)
-- =============================================================

INSERT INTO public.market_signals (job_family, metro_tier, posting_volume_30d, posting_change_pct, avg_salary_change_pct, ai_job_mentions_pct, market_health) VALUES
('frontend_developer', 'tier1', 4200, -18.5, -5.2, 45.0, 'declining'),
('frontend_developer', 'tier2', 1800, -8.0, -2.0, 25.0, 'stable'),
('backend_developer', 'tier1', 5100, -12.0, -3.0, 38.0, 'stable'),
('backend_developer', 'tier2', 2200, -5.0, 0.0, 18.0, 'stable'),
('data_analyst', 'tier1', 3800, -22.0, -8.0, 52.0, 'declining'),
('data_analyst', 'tier2', 1200, -10.0, -3.0, 30.0, 'declining'),
('ml_engineer', 'tier1', 6200, 35.0, 12.0, 80.0, 'booming'),
('ml_engineer', 'tier2', 1500, 15.0, 5.0, 60.0, 'booming'),
('digital_marketer', 'tier1', 2800, -25.0, -10.0, 55.0, 'declining'),
('digital_marketer', 'tier2', 900, -12.0, -5.0, 35.0, 'declining'),
('content_writer', 'tier1', 1500, -40.0, -15.0, 65.0, 'declining'),
('content_writer', 'tier2', 600, -20.0, -8.0, 40.0, 'declining'),
('graphic_designer', 'tier1', 2100, -15.0, -6.0, 42.0, 'declining'),
('graphic_designer', 'tier2', 800, -5.0, -2.0, 22.0, 'stable'),
('ui_ux_designer', 'tier1', 3200, 5.0, 3.0, 30.0, 'stable'),
('ui_ux_designer', 'tier2', 1100, 2.0, 0.0, 15.0, 'stable'),
('financial_analyst', 'tier1', 2500, -10.0, -4.0, 28.0, 'stable'),
('accountant', 'tier1', 1800, -30.0, -12.0, 35.0, 'declining'),
('accountant', 'tier2', 1200, -15.0, -5.0, 18.0, 'declining'),
('customer_support', 'tier1', 8000, -35.0, -18.0, 70.0, 'declining'),
('customer_support', 'tier2', 5000, -20.0, -10.0, 45.0, 'declining'),
('sales_executive', 'tier1', 4500, 8.0, 2.0, 20.0, 'stable'),
('sales_executive', 'tier2', 3000, 5.0, 1.0, 12.0, 'stable'),
('project_manager', 'tier1', 3800, 10.0, 5.0, 25.0, 'booming'),
('project_manager', 'tier2', 1500, 5.0, 2.0, 15.0, 'stable'),
('qa_tester', 'tier1', 2800, -28.0, -12.0, 48.0, 'declining'),
('qa_tester', 'tier2', 1000, -15.0, -5.0, 25.0, 'declining'),
('doctor', 'tier1', 5000, 5.0, 3.0, 10.0, 'stable'),
('nurse', 'tier1', 6000, 8.0, 2.0, 5.0, 'booming'),
('teacher', 'tier1', 3500, -5.0, -2.0, 15.0, 'stable'),
('data_entry_operator', 'tier1', 500, -60.0, -25.0, 80.0, 'declining'),
('data_entry_operator', 'tier2', 800, -40.0, -15.0, 50.0, 'declining'),
('hr_generalist', 'tier1', 2200, -8.0, -3.0, 22.0, 'stable'),
('legal_associate', 'tier1', 1800, -5.0, 0.0, 18.0, 'stable'),
('devops_engineer', 'tier1', 4000, 5.0, 4.0, 32.0, 'stable'),
('mechanical_engineer', 'tier1', 2000, -8.0, -3.0, 15.0, 'stable'),
('supply_chain_manager', 'tier1', 1500, 3.0, 2.0, 20.0, 'stable'),
('pharmacist', 'tier1', 1200, -5.0, -2.0, 12.0, 'stable'),
('video_editor', 'tier1', 1800, -20.0, -8.0, 50.0, 'declining');


-- =============================================================
-- VIRAL MECHANICS TABLES
-- =============================================================

-- Fate cards: shareable images with tracking
CREATE TABLE public.fate_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id),
  card_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_count INTEGER NOT NULL DEFAULT 0,
  platforms JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Share tracking: every share event
CREATE TABLE public.share_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fate_card_id UUID REFERENCES public.fate_cards(id),
  assessment_id UUID REFERENCES public.assessments(id),
  platform TEXT NOT NULL DEFAULT 'unknown',
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Company benchmarks: aggregated anonymous fate scores
CREATE TABLE public.company_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  avg_fate_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  assessment_count INTEGER NOT NULL DEFAULT 0,
  risk_tier TEXT NOT NULL DEFAULT 'medium',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_benchmarks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Fate cards are publicly readable" ON public.fate_cards FOR SELECT USING (true);
CREATE POLICY "Anyone can create fate cards" ON public.fate_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fate card share count" ON public.fate_cards FOR UPDATE USING (true);

CREATE POLICY "Anyone can create share events" ON public.share_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Share events are publicly readable" ON public.share_events FOR SELECT USING (true);

CREATE POLICY "Company benchmarks are publicly readable" ON public.company_benchmarks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert company benchmarks" ON public.company_benchmarks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update company benchmarks" ON public.company_benchmarks FOR UPDATE USING (true);

-- Seed some company benchmarks
INSERT INTO public.company_benchmarks (company_name, industry, avg_fate_score, assessment_count, risk_tier) VALUES
('TCS', 'IT & Software', 68, 342, 'high'),
('Infosys', 'IT & Software', 65, 287, 'high'),
('Wipro', 'IT & Software', 72, 198, 'high'),
('HCL Technologies', 'IT & Software', 64, 156, 'high'),
('Tech Mahindra', 'IT & Software', 70, 134, 'high'),
('Cognizant', 'IT & Software', 66, 189, 'high'),
('Accenture India', 'IT & Software', 58, 245, 'medium'),
('Google India', 'IT & Software', 45, 89, 'medium'),
('Microsoft India', 'IT & Software', 42, 76, 'medium'),
('Amazon India', 'IT & Software', 48, 112, 'medium'),
('Flipkart', 'IT & Software', 52, 98, 'medium'),
('Paytm', 'Finance & Banking', 55, 67, 'medium'),
('HDFC Bank', 'Finance & Banking', 62, 156, 'high'),
('ICICI Bank', 'Finance & Banking', 60, 134, 'medium'),
('SBI', 'Finance & Banking', 58, 201, 'medium'),
('Kotak Mahindra', 'Finance & Banking', 56, 89, 'medium'),
('Byju''s', 'Education', 48, 78, 'medium'),
('Unacademy', 'Education', 52, 56, 'medium'),
('Zomato', 'Other', 55, 67, 'medium'),
('Swiggy', 'Other', 53, 58, 'medium'),
('Reliance Jio', 'IT & Software', 50, 145, 'medium'),
('Tata Motors', 'Manufacturing', 45, 89, 'medium'),
('Mahindra', 'Manufacturing', 42, 67, 'medium'),
('Apollo Hospitals', 'Healthcare', 28, 45, 'low'),
('Fortis Healthcare', 'Healthcare', 30, 38, 'low'),
('Ogilvy India', 'Marketing & Advertising', 72, 45, 'high'),
('Dentsu India', 'Marketing & Advertising', 70, 38, 'high'),
('WPP India', 'Marketing & Advertising', 74, 52, 'high'),
('Ernst & Young India', 'Finance & Banking', 55, 123, 'medium'),
('Deloitte India', 'Other', 50, 167, 'medium');

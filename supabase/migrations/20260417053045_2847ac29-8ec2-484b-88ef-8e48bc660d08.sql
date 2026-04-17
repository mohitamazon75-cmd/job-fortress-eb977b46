-- Add missing user-reported salary column to scans table.
-- create-scan edge function writes to this column when users provide their salary
-- during onboarding. Without it, ALL scans with salary input fail with PGRST204.

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS estimated_monthly_salary_inr integer;

-- Validation: salary must be in realistic INR range (₹5K–₹50L/month).
-- Rejects out-of-range values silently at the DB level as a defense-in-depth
-- measure (create-scan also validates client-side).
ALTER TABLE public.scans
  DROP CONSTRAINT IF EXISTS scans_salary_range_check;

ALTER TABLE public.scans
  ADD CONSTRAINT scans_salary_range_check
  CHECK (
    estimated_monthly_salary_inr IS NULL
    OR (estimated_monthly_salary_inr >= 5000 AND estimated_monthly_salary_inr <= 5000000)
  );
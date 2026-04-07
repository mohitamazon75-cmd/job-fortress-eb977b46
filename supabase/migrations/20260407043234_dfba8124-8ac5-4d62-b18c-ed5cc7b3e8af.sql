-- Track monthly AI coach question usage per user
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS coach_questions_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coach_usage_reset_at TIMESTAMPTZ DEFAULT now();

-- Function to reset usage monthly and check limit
CREATE OR REPLACE FUNCTION public.check_and_increment_coach_usage(_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, questions_used INTEGER, questions_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  FREE_LIMIT CONSTANT INTEGER := 5;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE id = _user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 0, FREE_LIMIT;
    RETURN;
  END IF;

  -- Reset if last reset was over 30 days ago
  IF profile_row.coach_usage_reset_at < now() - INTERVAL '30 days' THEN
    UPDATE profiles 
    SET coach_questions_used = 0,
        coach_usage_reset_at = now()
    WHERE id = _user_id;
    profile_row.coach_questions_used := 0;
  END IF;
  
  -- Pro users: always allowed
  IF profile_row.subscription_tier = 'pro' 
     AND profile_row.subscription_expires_at > now() THEN
    RETURN QUERY SELECT true, profile_row.coach_questions_used, 999;
    RETURN;
  END IF;
  
  -- Free users: check limit
  IF profile_row.coach_questions_used >= FREE_LIMIT THEN
    RETURN QUERY SELECT false, profile_row.coach_questions_used, 0;
    RETURN;
  END IF;
  
  -- Increment and allow
  UPDATE profiles 
  SET coach_questions_used = coach_questions_used + 1
  WHERE id = _user_id;
  
  RETURN QUERY SELECT 
    true, 
    profile_row.coach_questions_used + 1,
    FREE_LIMIT - (profile_row.coach_questions_used + 1);
END;
$$;
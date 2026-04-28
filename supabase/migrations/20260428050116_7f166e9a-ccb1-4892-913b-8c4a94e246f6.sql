-- Server-side enforcement of Story Bank free-tier cap (3 stories max for free users)
-- Closes the bypass hole where the cap lived only in the React component.

CREATE OR REPLACE FUNCTION public.enforce_story_bank_free_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_pro BOOLEAN;
  story_count INTEGER;
  FREE_LIMIT CONSTANT INTEGER := 3;
BEGIN
  -- Determine if user has an active Pro subscription
  SELECT (subscription_tier = 'pro' AND subscription_expires_at > now())
  INTO is_pro
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Pro users: no cap
  IF COALESCE(is_pro, false) THEN
    RETURN NEW;
  END IF;

  -- Free users: enforce limit
  SELECT count(*) INTO story_count
  FROM public.user_stories
  WHERE user_id = NEW.user_id;

  IF story_count >= FREE_LIMIT THEN
    RAISE EXCEPTION 'STORY_BANK_FREE_LIMIT_REACHED: Free plan allows up to % stories. Upgrade to Pro for unlimited stories.', FREE_LIMIT
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_story_bank_cap_trigger
BEFORE INSERT ON public.user_stories
FOR EACH ROW
EXECUTE FUNCTION public.enforce_story_bank_free_cap();
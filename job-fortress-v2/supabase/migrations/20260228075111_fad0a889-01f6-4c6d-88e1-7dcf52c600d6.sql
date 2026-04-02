
-- ═══════════════════════════════════════════════════════════════
-- KG FEEDBACK LOOP: Auto-adjust skill_risk_matrix from user ratings
-- ═══════════════════════════════════════════════════════════════
-- Logic:
--   - Low accuracy (1-2 stars): Skills were likely mis-scored → nudge automation_risk
--     toward the mean (50) by a small learning rate (2 points per feedback)
--   - Medium accuracy (3 stars): No adjustment
--   - High accuracy (4-5 stars): Reinforce current values by nudging 1 point
--     away from the mean (strengthens conviction)
--   - Each skill has a max cumulative adjustment of ±15 points from its seed value
--     to prevent feedback drift from destroying the KG
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Add a column to track cumulative feedback adjustment
ALTER TABLE public.skill_risk_matrix 
ADD COLUMN IF NOT EXISTS feedback_adjustment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_count integer DEFAULT 0;

-- Step 2: Create the feedback processing function
CREATE OR REPLACE FUNCTION public.apply_feedback_to_kg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scan_report jsonb;
  skill_adj jsonb;
  skill_name_val text;
  current_risk numeric;
  current_adj numeric;
  current_count integer;
  delta numeric;
  new_risk numeric;
  max_cumulative_adj numeric := 15;
  learning_rate_low numeric := 2;    -- points per low-accuracy feedback
  learning_rate_high numeric := 1;   -- reinforcement per high-accuracy feedback
BEGIN
  -- Only process if accuracy_rating is provided
  IF NEW.accuracy_rating IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the scan report
  SELECT final_json_report INTO scan_report
  FROM public.scans
  WHERE id = NEW.scan_id;

  IF scan_report IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract skill adjustments from the score breakdown
  IF scan_report->'score_breakdown'->'skill_adjustments' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Iterate over each skill in the scan's breakdown
  FOR skill_adj IN SELECT * FROM jsonb_array_elements(scan_report->'score_breakdown'->'skill_adjustments')
  LOOP
    skill_name_val := skill_adj->>'skill_name';
    
    IF skill_name_val IS NULL THEN
      CONTINUE;
    END IF;

    -- Look up current values in KG
    SELECT automation_risk, COALESCE(feedback_adjustment, 0), COALESCE(feedback_count, 0)
    INTO current_risk, current_adj, current_count
    FROM public.skill_risk_matrix
    WHERE LOWER(skill_name) = LOWER(skill_name_val);

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Calculate delta based on accuracy rating
    IF NEW.accuracy_rating <= 2 THEN
      -- Low accuracy: nudge toward mean (50)
      IF current_risk > 50 THEN
        delta := -learning_rate_low;
      ELSIF current_risk < 50 THEN
        delta := learning_rate_low;
      ELSE
        delta := 0;
      END IF;
    ELSIF NEW.accuracy_rating >= 4 THEN
      -- High accuracy: reinforce (nudge away from mean)
      IF current_risk > 50 THEN
        delta := learning_rate_high;
      ELSIF current_risk < 50 THEN
        delta := -learning_rate_high;
      ELSE
        delta := 0;
      END IF;
    ELSE
      -- Rating = 3: no adjustment
      delta := 0;
    END IF;

    -- Apply cumulative cap
    IF ABS(current_adj + delta) > max_cumulative_adj THEN
      delta := 0;
    END IF;

    -- Apply the update
    IF delta != 0 THEN
      new_risk := LEAST(95, GREATEST(5, current_risk + delta));
      
      UPDATE public.skill_risk_matrix
      SET automation_risk = new_risk,
          feedback_adjustment = COALESCE(feedback_adjustment, 0) + delta,
          feedback_count = COALESCE(feedback_count, 0) + 1
      WHERE LOWER(skill_name) = LOWER(skill_name_val);
    ELSE
      -- Still track the feedback count even if no adjustment
      UPDATE public.skill_risk_matrix
      SET feedback_count = COALESCE(feedback_count, 0) + 1
      WHERE LOWER(skill_name) = LOWER(skill_name_val);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Step 3: Create the trigger
DROP TRIGGER IF EXISTS trg_feedback_kg_update ON public.scan_feedback;
CREATE TRIGGER trg_feedback_kg_update
  AFTER INSERT ON public.scan_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_feedback_to_kg();

ALTER TABLE public.user_action_signals
  DROP CONSTRAINT IF EXISTS user_action_signals_action_type_check;

ALTER TABLE public.user_action_signals
  ADD CONSTRAINT user_action_signals_action_type_check
  CHECK (action_type IN (
    'card_viewed','job_clicked','skill_selected','vocab_copied',
    'pivot_expanded','plan_action_checked','share_whatsapp','share_linkedin',
    'rescan_initiated','outcome_reported','tool_opened',
    'modal_opened','journey_complete','whatsapp',
    'reveal_opened','reveal_reopened','scroll_depth',
    'share_clicked','share_completed',
    'pro_cta_clicked','coach_question_asked'
  ));
UPDATE public.scans
SET feedback_flag = 'legacy_lazy_role'
WHERE feedback_flag IS NULL
  AND (
    role_detected ILIKE '%General Execution Tasks%'
    OR role_detected ILIKE '%Industry Professional%'
    OR role_detected ~ '^(Senior |Junior |Lead |Principal )?[A-Z][a-z]+ (Specialist|Practitioner|Professional)$'
       AND role_detected NOT ILIKE '%Engineer%'
       AND role_detected NOT ILIKE '%Manager%'
       AND role_detected NOT ILIKE '%Director%'
  );

-- Enable leaked password protection (HaveIBeenPwned integration)
-- This is configured at the auth level, but we ensure the setting is applied
ALTER ROLE authenticator SET pgrst.db_leaked_password_protection = 'on';

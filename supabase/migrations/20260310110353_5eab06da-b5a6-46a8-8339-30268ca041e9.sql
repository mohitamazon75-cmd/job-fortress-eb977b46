
-- Enable leaked password protection (HaveIBeenPwned) via auth config
-- This sets the auth.config to check passwords against HIBP database
ALTER ROLE authenticator SET pgrst.app.settings.password_hibp_enabled TO 'on';

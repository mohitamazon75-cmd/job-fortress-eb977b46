-- Sprint 22: Enable pg_cron + pg_net extensions for scheduled nurture emails
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
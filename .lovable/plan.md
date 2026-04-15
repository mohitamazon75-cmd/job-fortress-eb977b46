

# Deployment Plan — Edge Functions + Migrations

## Current State

- **Migrations already exist** in the codebase:
  - `20260415000001_analytics_events.sql` — analytics_events table
  - `20260415092922_...sql` — duplicate analytics_events (uses `IF NOT EXISTS`, safe)
  - `20260415132107_pro_trial_column.sql` — trial_started_at column on profiles
- These migrations are managed by Lovable Cloud and deploy automatically — no manual SQL needed.
- All 8 edge functions exist in `supabase/functions/`.

## What I Will Do (once you approve)

### Step 1: Deploy edge functions
Deploy these 8 functions using the deploy tool:
`process-scan`, `chat-report`, `create-scan`, `coach-nudge`, `score-change-notify`, `india-jobs`, `career-obituary`, `activate-trial`

### Step 2: Confirm migrations applied
The two migrations (`analytics_events` and `pro_trial_column`) are already in the migrations folder and should have been applied automatically by Lovable Cloud. I will verify by checking the database schema.

### Items NOT handled here (require your manual action)
- **WhatsApp secrets** (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`) — need Meta Business credentials
- **AFFINDA_API_KEY** — need Affinda account
- **pg_cron scheduled jobs** — need to be inserted via the insert tool (not migrations) since they contain project-specific URLs/keys
- **WhatsApp template registration** — Meta Business Manager, outside Lovable

### Technical Details
- No code changes needed — all functions and migrations already exist
- Deployment uses `supabase--deploy_edge_functions` tool
- Migrations are auto-applied by Lovable Cloud's migration runner


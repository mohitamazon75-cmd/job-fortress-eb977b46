-- ═══════════════════════════════════════════════════════════════════════════
-- AI Replacement Diagnostic Results table
-- Feature: "Will My Boss Replace Me?" diagnostic card
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.diagnostic_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- User inputs
  job_title text not null,
  monthly_ctc integer not null,         -- stored in ₹, e.g. 200000
  experience_band text not null,        -- '0-2 yrs' | '3-5 yrs' | '6-10 yrs' | '10+ yrs'
  ai_skills text[] default '{}',
  human_skills text[] default '{}',

  -- Computed client-side (stored for report generation)
  risk_score integer not null,          -- 0–100
  boss_saves_monthly integer,           -- ₹/month
  multiplier_needed numeric(5,1),       -- e.g. 33.3
  ai_covers_percent integer,            -- e.g. 61

  -- Claude-generated content (cached to avoid re-calling)
  survival_plan jsonb,
  role_prompts jsonb,
  verdict_text text,

  -- Sharing
  share_token text unique default encode(gen_random_bytes(12), 'hex'),
  is_shared boolean default false
);

-- Indexes
create index if not exists idx_diagnostic_results_user_id on public.diagnostic_results(user_id);
create index if not exists idx_diagnostic_results_share_token on public.diagnostic_results(share_token);
create index if not exists idx_diagnostic_results_created_at on public.diagnostic_results(created_at desc);

-- Updated_at trigger (reuse existing function if already exists, otherwise create)
create or replace function public.update_diagnostic_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger update_diagnostic_results_updated_at
  before update on public.diagnostic_results
  for each row execute function public.update_diagnostic_updated_at();

-- RLS
alter table public.diagnostic_results enable row level security;

create policy "Users read own results"
  on public.diagnostic_results for select
  using (auth.uid() = user_id);

create policy "Anyone can insert"
  on public.diagnostic_results for insert
  with check (true);

create policy "Users update own results"
  on public.diagnostic_results for update
  using (auth.uid() = user_id);

create policy "Public read shared results"
  on public.diagnostic_results for select
  using (is_shared = true);

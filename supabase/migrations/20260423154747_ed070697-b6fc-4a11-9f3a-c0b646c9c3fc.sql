create table if not exists public.human_edge_cache (
  cache_key text primary key,
  scan_id uuid,
  role_context text,
  bundle jsonb not null default '{}'::jsonb,
  source text not null default 'ai_gateway',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists human_edge_cache_expires_at_idx on public.human_edge_cache (expires_at);
create index if not exists human_edge_cache_scan_id_idx on public.human_edge_cache (scan_id);

alter table public.human_edge_cache enable row level security;

drop policy if exists "service role manages human_edge_cache" on public.human_edge_cache;
create policy "service role manages human_edge_cache"
  on public.human_edge_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
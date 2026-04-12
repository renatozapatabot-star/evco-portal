-- V1.5 Feature 13 — bilingual toggle
-- Adds per-user locale preference. RLS: user can read/update their own row only.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'es-MX' check (locale in ('es-MX', 'en-US')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_self_select" on public.user_preferences;
create policy "user_preferences_self_select"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_preferences_self_insert" on public.user_preferences;
create policy "user_preferences_self_insert"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_self_update" on public.user_preferences;
create policy "user_preferences_self_update"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

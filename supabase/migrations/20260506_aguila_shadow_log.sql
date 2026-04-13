-- AGUILA AI shadow message log.
-- Captures every AGUILA AI interaction for internal training + anomaly review.
-- RLS: service_role only. NEVER exposed to any authenticated user, any role.

create table if not exists public.aguila_shadow_log (
  id              bigserial primary key,
  message_id      uuid not null,
  user_id         uuid,
  operator_id     uuid,
  sender_role     text not null,
  recipient_role  text,
  topic_class     text,
  company_id      text,
  tools_called    text[] default '{}',
  response_time_ms integer,
  escalated       boolean default false,
  resolved        boolean default false,
  question_excerpt text,
  answer_excerpt  text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists aguila_shadow_log_message_id_idx
  on public.aguila_shadow_log(message_id);
create index if not exists aguila_shadow_log_company_id_idx
  on public.aguila_shadow_log(company_id);
create index if not exists aguila_shadow_log_sender_role_idx
  on public.aguila_shadow_log(sender_role);
create index if not exists aguila_shadow_log_topic_class_idx
  on public.aguila_shadow_log(topic_class);
create index if not exists aguila_shadow_log_created_at_idx
  on public.aguila_shadow_log(created_at desc);

alter table public.aguila_shadow_log enable row level security;

-- Deny-all to authenticated + anon. Service role bypasses RLS by design.
drop policy if exists "deny_all_authenticated" on public.aguila_shadow_log;
create policy "deny_all_authenticated" on public.aguila_shadow_log
  for all
  to authenticated, anon
  using (false)
  with check (false);

comment on table public.aguila_shadow_log is
  'Internal AGUILA AI message telemetry. Never exposed to users. service_role writes only.';

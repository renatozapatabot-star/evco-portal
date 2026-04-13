-- AGUILA @mention routing table.
-- Resolves @handles (e.g. @tito, @eduardo, @evco) to a recipient role +
-- optional operator_id. Seeded with current team handles. Operators + owners
-- reference this when AGUILA AI parses a message.

create table if not exists public.aguila_mention_routes (
  id            bigserial primary key,
  handle        text unique not null,
  recipient_role text not null check (recipient_role in
    ('client','operator','admin','broker','warehouse','contabilidad')),
  operator_id   uuid,
  clave_cliente text,
  escalated     boolean default false,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists aguila_mention_routes_handle_idx
  on public.aguila_mention_routes(lower(handle));

alter table public.aguila_mention_routes enable row level security;

-- Authenticated internal users can read (to render the @mention picker in the UI).
-- Writes restricted to service_role.
drop policy if exists "internal_read" on public.aguila_mention_routes;
create policy "internal_read" on public.aguila_mention_routes
  for select
  to authenticated
  using (active = true);

-- Seed the known handles. Operator_id filled in later by Tito via admin page.
insert into public.aguila_mention_routes (handle, recipient_role, escalated)
values
  ('tito',     'admin',    true),
  ('eduardo',  'operator', false),
  ('juan',     'operator', false),
  ('eloisa',   'operator', false),
  ('arturo',   'operator', false),
  ('renato',   'admin',    false)
on conflict (handle) do nothing;

-- Map client claves → client recipient. clave_cliente filled on client creation.
insert into public.aguila_mention_routes (handle, recipient_role, clave_cliente)
values
  ('evco',    'client', '9254'),
  ('mafesa',  'client', '4598')
on conflict (handle) do nothing;

comment on table public.aguila_mention_routes is
  'AGUILA AI @handle → recipient mapping. Read-allowed for authenticated for UI picker.';

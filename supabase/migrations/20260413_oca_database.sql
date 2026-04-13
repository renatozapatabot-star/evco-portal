-- AGUILA · OCA — Opinión de Clasificación Arancelaria registry.
-- Admins/brokers generate formal opinions signed by Renato Zapata III.
-- Operators can request drafts; approvals gated to admin/broker.
-- Every opinion has immutable audit trail via audit_log trigger.

create extension if not exists "pgcrypto";

create table if not exists oca_database (
  id                    uuid primary key default gen_random_uuid(),
  opinion_number        text unique not null,
  company_id            uuid,
  trafico_id            text,
  product_description   text not null,
  fraccion_recomendada  text not null,
  pais_origen           text not null,
  uso_final             text,
  fundamento_legal      text,
  nom_aplicable         text,
  tmec_elegibilidad     boolean default false,
  vigencia_hasta        date,
  model_used            text,
  input_tokens          int,
  output_tokens         int,
  cost_usd              numeric(10,4),
  generated_by          text,
  approved_by           text,
  approved_at           timestamptz,
  pdf_url               text,
  status                text default 'draft' check (status in ('draft','approved','superseded')),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists oca_company_created_idx on oca_database (company_id, created_at desc);
create index if not exists oca_status_idx on oca_database (status);
create index if not exists oca_trafico_idx on oca_database (trafico_id) where trafico_id is not null;

alter table oca_database enable row level security;

-- Admin + broker: full read/write.
drop policy if exists oca_admin_all on oca_database;
create policy oca_admin_all on oca_database
  for all
  using (current_setting('app.role', true) in ('admin','broker'))
  with check (current_setting('app.role', true) in ('admin','broker'));

-- Operator: read + insert drafts for their context; no approve/update.
drop policy if exists oca_operator_read on oca_database;
create policy oca_operator_read on oca_database
  for select
  using (current_setting('app.role', true) = 'operator');

drop policy if exists oca_operator_insert on oca_database;
create policy oca_operator_insert on oca_database
  for insert
  with check (
    current_setting('app.role', true) = 'operator'
    and status = 'draft'
  );

-- Client: read approved opinions scoped to their company only.
drop policy if exists oca_client_read on oca_database;
create policy oca_client_read on oca_database
  for select
  using (
    current_setting('app.role', true) = 'client'
    and status = 'approved'
    and company_id::text = current_setting('app.company_id', true)
  );

-- Audit: pipe into shared audit_log (invariant 32 — canonical activity source).
create or replace function fn_audit_oca() returns trigger as $$
begin
  insert into audit_log (table_name, record_id, action, changed_by, company_id, before_jsonb, after_jsonb)
  values (
    'oca_database',
    coalesce(new.id::text, old.id::text),
    tg_op,
    current_setting('app.user_id', true),
    coalesce(new.company_id::text, old.company_id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_oca_audit on oca_database;
create trigger trg_oca_audit
  after insert or update or delete on oca_database
  for each row execute function fn_audit_oca();

-- updated_at maintenance.
create or replace function fn_oca_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_oca_updated_at on oca_database;
create trigger trg_oca_updated_at
  before update on oca_database
  for each row execute function fn_oca_updated_at();

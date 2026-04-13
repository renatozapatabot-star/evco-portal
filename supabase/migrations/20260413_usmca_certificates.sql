-- AGUILA · USMCA / T-MEC Certificate of Origin registry.
-- Admins/brokers issue and sign certificates qualifying goods for IGI 0%
-- treatment. Every certificate is append-only audit evidence for SAT.
-- Per USMCA Art. 5.2 the certifier, exporter, producer, importer,
-- goods description, HS6, origin criterion, and blanket period are all
-- required before status can flip to 'approved'.

create extension if not exists "pgcrypto";

create table if not exists usmca_certificates (
  id                    uuid primary key default gen_random_uuid(),
  certificate_number    text unique not null,
  company_id            uuid,
  trafico_id            text,
  -- Article 5.2 minimum data elements
  certifier_role        text not null check (certifier_role in ('exporter','importer','producer')),
  certifier_name        text not null,
  certifier_title       text,
  certifier_address     text,
  certifier_email       text,
  certifier_phone       text,
  exporter_name         text,
  exporter_address      text,
  producer_name         text,
  producer_address      text,
  importer_name         text,
  importer_address      text,
  goods_description     text not null,
  hs_code               text not null,
  origin_criterion      text not null check (origin_criterion in ('A','B','C','D')),
  rvc_method            text,
  country_of_origin     text not null default 'US',
  blanket_from          date,
  blanket_to            date,
  -- Workflow
  status                text default 'draft' check (status in ('draft','approved','superseded')),
  generated_by          text,
  approved_by           text,
  approved_at           timestamptz,
  pdf_url               text,
  notes                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint usmca_blanket_order check (
    blanket_from is null or blanket_to is null or blanket_to >= blanket_from
  )
);

create index if not exists usmca_company_created_idx on usmca_certificates (company_id, created_at desc);
create index if not exists usmca_status_idx on usmca_certificates (status);
create index if not exists usmca_trafico_idx on usmca_certificates (trafico_id) where trafico_id is not null;
create index if not exists usmca_blanket_idx on usmca_certificates (blanket_from, blanket_to)
  where blanket_from is not null;

alter table usmca_certificates enable row level security;

drop policy if exists usmca_admin_all on usmca_certificates;
create policy usmca_admin_all on usmca_certificates
  for all
  using (current_setting('app.role', true) in ('admin','broker'))
  with check (current_setting('app.role', true) in ('admin','broker'));

drop policy if exists usmca_operator_read on usmca_certificates;
create policy usmca_operator_read on usmca_certificates
  for select
  using (current_setting('app.role', true) = 'operator');

drop policy if exists usmca_operator_insert on usmca_certificates;
create policy usmca_operator_insert on usmca_certificates
  for insert
  with check (
    current_setting('app.role', true) = 'operator'
    and status = 'draft'
  );

drop policy if exists usmca_client_read on usmca_certificates;
create policy usmca_client_read on usmca_certificates
  for select
  using (
    current_setting('app.role', true) = 'client'
    and status = 'approved'
    and company_id::text = current_setting('app.company_id', true)
  );

-- Audit into the canonical audit_log (invariant 32).
create or replace function fn_audit_usmca() returns trigger as $$
begin
  insert into audit_log (table_name, record_id, action, changed_by, company_id, before_jsonb, after_jsonb)
  values (
    'usmca_certificates',
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

drop trigger if exists trg_usmca_audit on usmca_certificates;
create trigger trg_usmca_audit
  after insert or update or delete on usmca_certificates
  for each row execute function fn_audit_usmca();

create or replace function fn_usmca_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_usmca_updated_at on usmca_certificates;
create trigger trg_usmca_updated_at
  before update on usmca_certificates
  for each row execute function fn_usmca_updated_at();

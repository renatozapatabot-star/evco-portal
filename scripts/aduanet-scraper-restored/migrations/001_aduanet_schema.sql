-- ADUANET Schema Migration
-- Run once in Supabase SQL Editor

create table if not exists public.coves (
  id bigserial primary key,
  cove_id text not null unique,
  aduana text, patente text, tipo_operacion text,
  fecha_emision date, rfc_emisor text, rfc_receptor text,
  valor_comercial numeric(18,4), moneda text, incoterm text,
  status text default 'ACTIVO',
  scraped_at timestamptz not null default now(),
  raw jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coves_fecha_idx on public.coves (fecha_emision desc);
create index if not exists coves_patente_idx on public.coves (patente);

create table if not exists public.pedimentos (
  id bigserial primary key,
  pedimento_id text not null unique,
  numero_pedimento text, aduana text, patente text,
  seccion_aduanera text, tipo_operacion text, clave_pedimento text,
  fecha_pago date, fecha_entrada date,
  valor_aduana numeric(18,4), importe_total numeric(18,4),
  moneda text, tipo_cambio numeric(12,6), rfc_importador text, estatus text,
  scraped_at timestamptz not null default now(),
  raw jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedimentos_fecha_pago_idx on public.pedimentos (fecha_pago desc);
create index if not exists pedimentos_patente_idx on public.pedimentos (patente);

create table if not exists public.scrape_runs (
  id bigserial primary key,
  status text not null,
  coves_count int default 0,
  pedimentos_count int default 0,
  error_msg text, duration_ms int,
  ran_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger coves_updated_at before update on public.coves
  for each row execute procedure public.set_updated_at();
create trigger pedimentos_updated_at before update on public.pedimentos
  for each row execute procedure public.set_updated_at();

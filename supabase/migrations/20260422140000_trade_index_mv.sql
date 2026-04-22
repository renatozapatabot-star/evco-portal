-- Trade Index V1 — lane + client-position materialized views over last 90 days.
-- Refreshed by scripts/refresh-trade-index.js on the nightly PM2 cron.
-- Access model: service-role only. The portal routes at /api/trade-index/*
-- read these MVs via the service-role client and apply role-based RBAC in the
-- API layer. Anon + authenticated roles have no direct read path.

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- Clean re-application (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

drop view             if exists public.v_trade_index_public                cascade;
drop materialized view if exists public.mv_trade_index_lane_90d            cascade;
drop materialized view if exists public.mv_trade_index_client_position_90d cascade;
drop function         if exists public.refresh_trade_index()               cascade;

-- ────────────────────────────────────────────────────────────────────────────
-- Per-client-per-lane aggregate. Source of truth for a client's own position.
-- ────────────────────────────────────────────────────────────────────────────

create materialized view public.mv_trade_index_client_position_90d as
with crossings as (
  select
    t.company_id,
    t.trafico                                                              as trafico_number,
    coalesce(t.aduana, '__unknown__')                                      as aduana,
    coalesce(t.oficina, '__unknown__')                                     as oficina,
    (extract(epoch from (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz)) / 86400.0) as clearance_days,
    t.predicted_tmec,
    t.tipo_cambio
  from public.traficos t
  where t.fecha_cruce  is not null
    and t.fecha_llegada is not null
    and t.fecha_cruce::timestamptz >= (now() - interval '90 days')
    and (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz) >= interval '0'
    and (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz) <= interval '60 days'
    and t.aduana     is not null
    and t.company_id is not null
),
factura_value as (
  select
    f.company_id,
    f.cve_trafico,
    sum(
      case
        when upper(trim(coalesce(f.moneda, ''))) = 'USD' then f.valor_comercial
        when upper(trim(coalesce(f.moneda, ''))) = 'MXN'
             then f.valor_comercial / nullif(c.tipo_cambio, 0)
        else null
      end
    ) as value_usd
  from public.globalpc_facturas f
  join crossings c
    on c.company_id     = f.company_id
   and c.trafico_number = f.cve_trafico
  group by f.company_id, f.cve_trafico
),
enriched as (
  select c.*, fv.value_usd
  from crossings c
  left join factura_value fv
    on fv.company_id  = c.company_id
   and fv.cve_trafico = c.trafico_number
)
select
  company_id,
  aduana,
  oficina,
  count(*)::bigint                                                                       as shipment_count,
  round(avg(clearance_days)::numeric, 3)                                                 as avg_clearance_days,
  round(percentile_cont(0.5) within group (order by clearance_days)::numeric, 3)         as median_clearance_days,
  round(sum(value_usd)::numeric, 2)                                                      as total_value_usd,
  round(
    (sum(case when predicted_tmec is true then 1 else 0 end)::numeric
     / nullif(count(*), 0)::numeric),
    4
  )                                                                                      as tmec_rate,
  now()                                                                                  as computed_at
from enriched
group by company_id, aduana, oficina
with data;

create unique index if not exists mv_trade_index_client_position_90d_pk
  on public.mv_trade_index_client_position_90d (company_id, aduana, oficina);

create index if not exists mv_trade_index_client_position_90d_company_idx
  on public.mv_trade_index_client_position_90d (company_id);

create index if not exists mv_trade_index_client_position_90d_lane_idx
  on public.mv_trade_index_client_position_90d (aduana, oficina);

-- ────────────────────────────────────────────────────────────────────────────
-- Per-lane aggregate across all clients. Percentiles require shipment-level
-- rows, so this re-derives from traficos rather than rolling up the client MV.
-- ────────────────────────────────────────────────────────────────────────────

create materialized view public.mv_trade_index_lane_90d as
with crossings as (
  select
    t.company_id,
    t.trafico                                                              as trafico_number,
    coalesce(t.aduana, '__unknown__')                                      as aduana,
    coalesce(t.oficina, '__unknown__')                                     as oficina,
    (extract(epoch from (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz)) / 86400.0) as clearance_days,
    t.predicted_tmec,
    t.tipo_cambio
  from public.traficos t
  where t.fecha_cruce  is not null
    and t.fecha_llegada is not null
    and t.fecha_cruce::timestamptz >= (now() - interval '90 days')
    and (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz) >= interval '0'
    and (t.fecha_cruce::timestamptz - t.fecha_llegada::timestamptz) <= interval '60 days'
    and t.aduana     is not null
    and t.company_id is not null
),
factura_value as (
  select
    f.company_id,
    f.cve_trafico,
    sum(
      case
        when upper(trim(coalesce(f.moneda, ''))) = 'USD' then f.valor_comercial
        when upper(trim(coalesce(f.moneda, ''))) = 'MXN'
             then f.valor_comercial / nullif(c.tipo_cambio, 0)
        else null
      end
    ) as value_usd
  from public.globalpc_facturas f
  join crossings c
    on c.company_id     = f.company_id
   and c.trafico_number = f.cve_trafico
  group by f.company_id, f.cve_trafico
),
enriched as (
  select c.*, fv.value_usd
  from crossings c
  left join factura_value fv
    on fv.company_id  = c.company_id
   and fv.cve_trafico = c.trafico_number
)
select
  aduana,
  oficina,
  count(*)::bigint                                                                       as shipment_count,
  count(distinct company_id)::bigint                                                     as distinct_company_count,
  round(avg(clearance_days)::numeric, 3)                                                 as avg_clearance_days,
  round(percentile_cont(0.5)  within group (order by clearance_days)::numeric, 3)        as median_clearance_days,
  round(percentile_cont(0.10) within group (order by clearance_days)::numeric, 3)        as p10_clearance_days,
  round(percentile_cont(0.90) within group (order by clearance_days)::numeric, 3)        as p90_clearance_days,
  round(sum(value_usd)::numeric, 2)                                                      as total_value_usd,
  round(
    (sum(case when predicted_tmec is true then 1 else 0 end)::numeric
     / nullif(count(*), 0)::numeric),
    4
  )                                                                                      as tmec_rate,
  now()                                                                                  as computed_at
from enriched
group by aduana, oficina
with data;

create unique index if not exists mv_trade_index_lane_90d_pk
  on public.mv_trade_index_lane_90d (aduana, oficina);

-- ────────────────────────────────────────────────────────────────────────────
-- k-anonymity view — what a client can safely see. A lane must carry shipments
-- from at least 3 distinct companies before it appears here, so no single
-- company's numbers can be inferred by subtraction.
-- ────────────────────────────────────────────────────────────────────────────

create or replace view public.v_trade_index_public as
select
  aduana,
  oficina,
  shipment_count,
  distinct_company_count,
  avg_clearance_days,
  median_clearance_days,
  p10_clearance_days,
  p90_clearance_days,
  total_value_usd,
  tmec_rate,
  computed_at
from public.mv_trade_index_lane_90d
where distinct_company_count >= 3;

-- ────────────────────────────────────────────────────────────────────────────
-- Refresh function. Called by scripts/refresh-trade-index.js nightly + on
-- demand. Client-position refreshes first so the lane view sees a consistent
-- snapshot even though they share no rows.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.refresh_trade_index()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  refresh materialized view concurrently public.mv_trade_index_client_position_90d;
  refresh materialized view concurrently public.mv_trade_index_lane_90d;
end;
$fn$;

-- ────────────────────────────────────────────────────────────────────────────
-- Access control — service role only. The portal API layer is the RBAC gate.
-- ────────────────────────────────────────────────────────────────────────────

revoke all on public.mv_trade_index_client_position_90d from public;
revoke all on public.mv_trade_index_lane_90d            from public;
revoke all on public.v_trade_index_public               from public;
revoke all on function public.refresh_trade_index()     from public;

grant  select  on public.mv_trade_index_client_position_90d to service_role;
grant  select  on public.mv_trade_index_lane_90d            to service_role;
grant  select  on public.v_trade_index_public               to service_role;
grant  execute on function public.refresh_trade_index()     to service_role;

commit;

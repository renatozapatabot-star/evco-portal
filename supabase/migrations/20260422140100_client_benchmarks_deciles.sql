-- Add decile columns to client_benchmarks alongside existing quartiles.
-- The refresh-trade-index cron populates p10/p90 per metric so the
-- ComparativeWidget + /admin/trade-index can surface top/bottom 10% lines.
-- Existing top_quartile / bottom_quartile remain for back-compat with any
-- existing readers.

begin;

alter table public.client_benchmarks
  add column if not exists p10 numeric,
  add column if not exists p90 numeric;

commit;

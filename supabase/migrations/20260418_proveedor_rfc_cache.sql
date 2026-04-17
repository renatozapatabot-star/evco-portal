-- ──────────────────────────────────────────────────────────────────────
-- proveedor_rfc_cache — Tax ID/RFC lookup cache for supplier enrichment.
--
-- Purpose
--   When the real Formato 53 shows a supplier's Tax ID (US EIN or MX RFC)
--   that we don't have on `globalpc_proveedores`, we cache the resolution
--   here so repeat lookups are free + consistent. When the Formato 53
--   shows NO Tax ID but we have the supplier name, this table is where
--   `scripts/backfill-proveedor-rfc.js` stashes results from external
--   SAT/SAT-SIEM lookups.
--
-- Lifecycle
--   Idempotent upsert keyed on `name_normalized`. Updates bump
--   `last_lookup_at`.
--
-- Reads
--   `src/lib/sat/rfc-lookup.ts:lookupRfcByName()` — returns the cached
--   value if present + fresh (< 180 days); otherwise attempts a live
--   lookup and writes back.
--
-- Security
--   RLS FOR ALL USING (false) — service-role only. Nothing client-
--   facing needs direct access (rendered through the supplier surface).
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.proveedor_rfc_cache (
  name_normalized    text        primary key,
  display_name       text        not null,
  rfc                text,
  source             text        not null default 'unknown',  -- 'formato53' | 'sat_consulta' | 'manual' | 'unknown'
  last_lookup_at     timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists proveedor_rfc_cache_source_idx
  on public.proveedor_rfc_cache (source, last_lookup_at desc);

alter table public.proveedor_rfc_cache enable row level security;

drop policy if exists proveedor_rfc_cache_deny_all on public.proveedor_rfc_cache;
create policy proveedor_rfc_cache_deny_all
  on public.proveedor_rfc_cache
  for all
  using (false);

comment on table public.proveedor_rfc_cache is
  'Cache of supplier Tax ID/RFC resolutions. Populated by Formato 53 ingest + SAT backfill. Read via src/lib/sat/rfc-lookup.ts.';

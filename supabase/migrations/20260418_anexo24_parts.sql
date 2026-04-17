-- ──────────────────────────────────────────────────────────────────────
-- anexo24_parts — canonical IMMEX inventory truth per client.
--
-- Purpose
--   Phase 3 of the Anexo 24 canonicalization plan (see
--   .planning/ANEXO_24_CANONICAL_PLAN.md). Today, merchandise names +
--   part numbers + tariff fractions render from globalpc_productos
--   (the synced mirror) or globalpc_partidas.descripcion (free-text
--   pedimento-line data). Both drift. The SAT-audit truth lives in
--   each client's Formato 53 — this table stores that truth.
--
-- Lifecycle
--   Versioned: every Formato 53 ingest writes new rows with
--   `vigente_desde = NOW()` and stamps previously-current rows with
--   `vigente_hasta`. Currency of a row is determined by
--   `vigente_hasta IS NULL`. Audit history is permanent — no DELETE.
--
-- Reads
--   `resolveMerchName(part)`, `resolveFraction(part)`, and
--   `resolvePartNumber(part)` in src/lib/reference/anexo24.ts prefer
--   this table's current row; fall back to globalpc_productos when
--   empty or when the feature flag USE_ANEXO24_CANONICAL is false.
--
-- Security
--   RLS: FOR ALL USING (false). Portal sessions use HMAC, not
--   Supabase JWT, so RLS policies that check auth.jwt() always
--   evaluate false — service role is the only reader. Matches the
--   established pattern in feedback_rls_policy_pattern.md.
--
-- Ingest
--   scripts/wsdl-document-pull.js already pulls Formato 53 per client
--   via GlobalPC.net's SOAP endpoint. Phase 3 activates the script in
--   PM2 cron (nightly 2:15 AM after globalpc-sync) + a reconciliation
--   job. This migration creates the table; the ingest job lights it up.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.anexo24_parts (
  id                              bigserial primary key,
  company_id                      text        not null,
  cve_producto                    text        not null,

  -- Canonical fields — the SAT audit answer.
  merchandise_name_official       text        not null,
  merchandise_name_ingles         text,
  fraccion_official               text,          -- formatted with dots
  umt_official                    text,
  pais_origen_official            text,
  valor_unitario_official         numeric(14,4),

  -- Versioning — one row per ingest. Currency = vigente_hasta IS NULL.
  vigente_desde                   timestamptz not null default now(),
  vigente_hasta                   timestamptz,

  -- Provenance.
  source_document_url             text,          -- storage URL for the Formato 53 PDF/XLSX
  source_document_hash            text,          -- SHA256 of the source so replays are idempotent
  ingested_at                     timestamptz not null default now(),
  ingested_by                     text        not null default 'system'
);

-- One current row per (company_id, cve_producto). Historical rows (with
-- vigente_hasta set) are allowed — only the active row is unique.
create unique index if not exists anexo24_parts_current_idx
  on public.anexo24_parts (company_id, cve_producto)
  where vigente_hasta is null;

-- Query patterns: lookup by (company_id, cve_producto), filter by fraction.
create index if not exists anexo24_parts_company_fraccion_idx
  on public.anexo24_parts (company_id, fraccion_official)
  where vigente_hasta is null;

create index if not exists anexo24_parts_ingest_idx
  on public.anexo24_parts (ingested_at desc);

-- Row-level security — HMAC sessions never satisfy JWT-claim policies,
-- so FOR ALL USING (false) is the simplest correct policy. Service
-- role bypasses automatically; this table is only read/written via
-- /api/ routes using createServerClient.
alter table public.anexo24_parts enable row level security;

drop policy if exists anexo24_parts_deny_all on public.anexo24_parts;
create policy anexo24_parts_deny_all
  on public.anexo24_parts
  for all
  using (false);

-- Hygiene note: this migration intentionally creates the table empty.
-- The Formato 53 backfill is a separate, reversible data migration —
-- staged per-client, throttled, logged to regression_guard_log. Do not
-- bundle it into this DDL.

comment on table public.anexo24_parts is
  'Canonical IMMEX inventory per client — truth source for merchandise name, part number, and tariff fraction. Populated by scripts/wsdl-document-pull.js Formato 53 ingest. Read through src/lib/reference/anexo24.ts.';

-- PORTAL · OCA Classifier — additive schema for Tito's self-service tool.
--
-- Context: `oca_database` already exists in two possible shapes (the legacy
-- pattern-cache schema reflected in types/supabase.ts, or the richer
-- 20260413_oca_database.sql schema if that migration has been applied).
-- This migration is additive and idempotent — it adds the 9 columns the
-- Classifier needs on top of whichever schema is live, plus signature-image
-- storage on `companies`, without touching or renaming existing columns.
--
-- Applied via: npx supabase db push  (queued in MIGRATION_QUEUE.md)
-- Rollback:    DROP COLUMN IF EXISTS <each column below>
--
-- Tenant isolation: `oca_database` already carries `company_id`; this
-- migration does not weaken RLS. The new columns inherit the existing
-- policies automatically.

------------------------------------------------------------------
-- oca_database — Classifier-specific fields
------------------------------------------------------------------

alter table if exists oca_database
  add column if not exists nico                          text,
  add column if not exists invoice_ref                   text,
  add column if not exists np_code                       text,
  add column if not exists razonamiento                  text,
  add column if not exists antecedentes                  text,
  add column if not exists analisis                      text,
  add column if not exists clasificacion_descripcion_tigie text,
  add column if not exists arancel_general               text,
  add column if not exists tmec_discrepancies            jsonb;

-- Composite index for Classifier lookups: "has Tito already signed an
-- OCA for invoice X, NP Y, under this tenant?"
create index if not exists idx_oca_company_invoice_np
  on oca_database (company_id, invoice_ref, np_code)
  where invoice_ref is not null and np_code is not null;

-- Supporting index for cross-tenant broker lookups (admin/broker sees
-- prior Tito signatures on the same NP across tenants).
create index if not exists idx_oca_np_code_created
  on oca_database (np_code, created_at desc)
  where np_code is not null;

------------------------------------------------------------------
-- companies — optional scanned signature image for OCA PDFs
------------------------------------------------------------------

-- The Classifier renders a typed "/s/ Renato Zapata III" line by default;
-- uploading a PNG at /settings/signature sets this URL, and the PDF
-- generator composes the image above the /s/ line on every subsequent
-- render. History is never rewritten — only the presentation layer
-- upgrades on the next download.

alter table if exists companies
  add column if not exists signature_image_url text;

-- Also supports the companies.name → legal suffix stripping flow that
-- already runs against companies elsewhere; no new index needed.

------------------------------------------------------------------
-- Verification
------------------------------------------------------------------
--
-- After apply, run:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'oca_database'
--      and column_name in (
--        'nico','invoice_ref','np_code','razonamiento',
--        'antecedentes','analisis','clasificacion_descripcion_tigie',
--        'arancel_general','tmec_discrepancies'
--      )
--    order by column_name;
--
-- Expect 9 rows.
--
--   select column_name from information_schema.columns
--    where table_name = 'companies' and column_name = 'signature_image_url';
--
-- Expect 1 row.
--
-- Golden-fixture lookup check (once Classifier runs against invoice #4526219):
--
--   select opinion_number, np_code, fraccion_recomendada, nico,
--          invoice_ref, status, approved_at
--     from oca_database
--    where invoice_ref = '4526219'
--      and company_id = '<evco company_id>';
--
-- Expect 4 rows (one per unknown NP: 18MB, 28MB, BG600E, W-5).

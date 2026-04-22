-- Invoice dedup signals on pedimento_facturas.
--
-- Adds three nullable columns used by src/lib/invoice-dedup.ts:
--   · file_hash                    — SHA-256 of the uploaded bytes
--   · normalized_invoice_number    — lowercase alphanumeric form of invoice_number
--   · supplier_rfc                 — supplier tax ID (authoritative identity)
--
-- Plus three partial indexes so the dedup lookup stays O(log n) on the
-- hot path without forcing legacy rows to backfill. All three columns
-- are nullable — the V1 duplicate policy is a soft warning, not a hard
-- block, so nothing here enforces uniqueness. A future hard-block
-- policy swaps the rfc+norm_invoice index for a UNIQUE constraint
-- without any data migration required.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- Safe to re-run. No RLS changes — pedimento_facturas RLS is governed
-- by the existing Block 8 policy.

ALTER TABLE pedimento_facturas
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS normalized_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_rfc TEXT;

COMMENT ON COLUMN pedimento_facturas.file_hash IS
  'SHA-256 hex of the uploaded bytes. Identical hash = identical file = exact content duplicate.';

COMMENT ON COLUMN pedimento_facturas.normalized_invoice_number IS
  'Lowercase, alphanumeric-only form of invoice_number. Collapses formatting variants (INV-2026/01 vs inv202601) for dedup.';

COMMENT ON COLUMN pedimento_facturas.supplier_rfc IS
  'Supplier tax ID when known. Combined with normalized_invoice_number gives a near-authoritative dedup key.';

-- Hot path: content-identical file already in the bank?
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_file_hash
  ON pedimento_facturas (company_id, file_hash)
  WHERE file_hash IS NOT NULL;

-- Hot path: same invoice number (any supplier) within a tenant.
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_norm_invoice
  ON pedimento_facturas (company_id, normalized_invoice_number)
  WHERE normalized_invoice_number IS NOT NULL;

-- Hot path: same (RFC, normalized_invoice_number) within a tenant.
-- The closest thing to an authoritative duplicate signal short of
-- comparing file bytes. Partial (both NOT NULL) because legacy rows
-- without RFC are noise in this lookup.
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_rfc_norm_invoice
  ON pedimento_facturas (company_id, supplier_rfc, normalized_invoice_number)
  WHERE supplier_rfc IS NOT NULL AND normalized_invoice_number IS NOT NULL;

-- Block 8 · pedimento_facturas — Invoice Bank base table
--
-- Purpose: receive invoices from suppliers, route them to the correct
-- embarque, and serve the /banco-facturas list + /api/invoice-bank API.
--
-- Why this migration exists:
--   The Invoice Bank feature is referenced by 14 codebase sites
--   (3 routes under /api/invoice-bank, 2 routes under /api/inbox,
--   /banco-facturas surface, dedup logic, vision classifier link)
--   but the CREATE TABLE migration was never authored. Production
--   has been returning PGRST205 "Could not find the table
--   'public.pedimento_facturas' in the schema cache" since the
--   feature shipped — observed in PR #36 (2026-05-05).
--
--   PR #36 (`fcbcb29`) hardened the listing route to return 200
--   with `{ rows: [], meta: { schema_pending: true } }` when the
--   table is missing, so the UI now renders an empty bank instead
--   of a crash banner. THIS migration ships the actual table so the
--   feature works end-to-end.
--
--   The dedup ALTER TABLE migration `20260422190000_invoice_dedup.sql`
--   already exists and adds three nullable columns (file_hash,
--   normalized_invoice_number, supplier_rfc) plus three partial
--   indexes. That migration assumed the base table existed but the
--   base table never shipped. Once THIS migration runs, applying the
--   dedup migration is a no-op (idempotent ADD COLUMN IF NOT EXISTS
--   + CREATE INDEX IF NOT EXISTS); both can run in either order.
--
-- Design:
--   - Tenant scope: company_id (text). Matches the Block EE
--     ownership-signal hierarchy at rank 4 (derived). App layer
--     filters by session.companyId on every read + write.
--   - Status lifecycle: unassigned → assigned → archived.
--     Soft delete = status='archived' + archived_at timestamp.
--     Append-only conceptually; UPDATE flips status, never DELETE.
--   - Currency: explicit MXN | USD per core-invariant #10.
--   - assigned_to_trafico_id is a soft text reference to traficos.trafico
--     (NOT a foreign key) because traficos cleanup operations would
--     otherwise cascade-orphan invoice rows. App-layer validates
--     the embarque exists in /api/invoice-bank/[id] PATCH.
--
-- Invariants enforced:
--   - company_id NOT NULL (tenant-isolation.md HARD contract).
--   - status CHECK constraint matches InvoiceBankStatus type at
--     src/lib/invoice-bank.ts.
--   - currency CHECK constraint matches the upload-route validator.
--   - RLS FOR ALL USING (false) — portal uses HMAC session, not
--     Supabase auth. Service-role bypasses. Pattern per
--     agent_actions / workflow_findings / lead_activities migrations.
--   - Application layer MUST verify company_id = session.companyId
--     on every read + every status transition. DB-level defense only
--     — the app-layer filter is the primary gate.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP POLICY IF EXISTS before CREATE POLICY). Safe to re-run.
--
-- Reference: PR #36 (fcbcb29) for the route-side hardening that
-- precedes this migration. The schema_pending metadata flag on the
-- listing route can be removed in a follow-up PR once this migration
-- is verified live in production (the empty-rows behavior is still
-- a valid default, but the schema_pending flag is dead code once
-- the table exists).
--
-- Verify after apply:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--     WHERE table_name = 'pedimento_facturas'
--     ORDER BY ordinal_position;
--   -- Expect 17 columns.
--
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid = 'public.pedimento_facturas'::regclass
--     AND NOT tgisinternal;
--   -- Expect 1 trigger: pedimento_facturas_set_updated_at.
--
--   SELECT pol.polname, pol.polcmd
--     FROM pg_policy pol
--     JOIN pg_class c ON c.oid = pol.polrelid
--     WHERE c.relname = 'pedimento_facturas';
--   -- Expect 1 policy: pedimento_facturas_deny_all · FOR ALL · USING (false).
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'pedimento_facturas';
--   -- Expect 4 indexes from this migration:
--   --   pedimento_facturas_pkey
--   --   idx_pedimento_facturas_company_status_received
--   --   idx_pedimento_facturas_company_assigned_trafico
--   --   idx_pedimento_facturas_company_received_at
--   -- Plus 3 dedup indexes (from 20260422190000_invoice_dedup.sql)
--   -- once that migration also lands:
--   --   idx_pedimento_facturas_company_file_hash
--   --   idx_pedimento_facturas_company_norm_invoice
--   --   idx_pedimento_facturas_rfc_norm_invoice

CREATE TABLE IF NOT EXISTS public.pedimento_facturas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  -- updated_at: maintained by the BEFORE-UPDATE trigger below
  -- (tg_pedimento_facturas_set_updated_at). Authored at table-creation
  -- time so we never need a backfill migration when audit-trail
  -- debugging becomes necessary.
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Ownership (tenant-isolation.md HARD contract: company_id NOT NULL).
  company_id                  text NOT NULL,
  uploaded_by                 text,

  -- Invoice identity (extracted by the vision classifier on upload;
  -- nullable because legacy uploads + low-confidence extractions exist).
  invoice_number              text,
  supplier_name               text,
  amount                      numeric(18, 2),
  currency                    text,

  -- Lifecycle.
  status                      text NOT NULL DEFAULT 'unassigned',
  received_at                 timestamptz NOT NULL DEFAULT now(),

  -- Assignment to an embarque (soft text ref — NOT a foreign key).
  -- App layer at /api/invoice-bank/[id] PATCH verifies the trafico
  -- exists and is tenant-scoped before flipping status.
  assigned_to_trafico_id      text,
  assigned_at                 timestamptz,

  -- Soft-delete.
  archived_at                 timestamptz,

  -- Storage pointer (Supabase Storage public URL).
  file_url                    text,

  -- Dedup signals (idempotently added by 20260422190000_invoice_dedup
  -- which originally targeted this table — declaring them here too so
  -- a fresh apply of this migration alone produces a complete schema).
  file_hash                   text,
  normalized_invoice_number   text,
  supplier_rfc                text,

  CONSTRAINT pedimento_facturas_status_check
    CHECK (status IN ('unassigned', 'assigned', 'archived')),
  CONSTRAINT pedimento_facturas_currency_check
    CHECK (currency IS NULL OR currency IN ('MXN', 'USD'))
);

COMMENT ON TABLE public.pedimento_facturas IS
  'Block 8 Invoice Bank — supplier invoices received via /banco-facturas, routed to embarques. Tenant-scoped via company_id (RLS deny-all + app-layer filter). Status: unassigned → assigned → archived.';

COMMENT ON COLUMN public.pedimento_facturas.company_id IS
  'Owning tenant slug. NOT NULL per Block EE tenant-isolation contract. App layer filters every read + write by session.companyId.';

COMMENT ON COLUMN public.pedimento_facturas.assigned_to_trafico_id IS
  'Soft text reference to traficos.trafico (NOT a foreign key). App layer validates existence + tenant scope on assignment.';

COMMENT ON COLUMN public.pedimento_facturas.archived_at IS
  'Soft-delete timestamp. Set when status flips to archived. The row is never DELETEd from this table — append-only audit trail.';

COMMENT ON COLUMN public.pedimento_facturas.file_hash IS
  'SHA-256 hex of the uploaded bytes. Identical hash = identical file = exact content duplicate. (Same definition as 20260422190000_invoice_dedup.sql.)';

COMMENT ON COLUMN public.pedimento_facturas.normalized_invoice_number IS
  'Lowercase, alphanumeric-only form of invoice_number. Collapses formatting variants (INV-2026/01 vs inv202601) for dedup.';

COMMENT ON COLUMN public.pedimento_facturas.supplier_rfc IS
  'Supplier tax ID when known. Combined with normalized_invoice_number gives a near-authoritative dedup key.';

-- ─────────────────────────────────────────────────────────────────────
-- updated_at maintenance trigger.
-- Pattern per leads_touch_updated_at_trg in
-- supabase/migrations/20260421150251_leads_table.sql — per-table
-- function (not a shared helper) so each table's update semantics can
-- diverge later (e.g. bumping a stage_changed_at companion column)
-- without touching unrelated tables.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS
-- before CREATE TRIGGER, so re-running this migration is safe.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_pedimento_facturas_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedimento_facturas_set_updated_at
  ON public.pedimento_facturas;

CREATE TRIGGER pedimento_facturas_set_updated_at
  BEFORE UPDATE ON public.pedimento_facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pedimento_facturas_set_updated_at();

-- Hot path: list endpoint at /api/invoice-bank filters by
-- (company_id, status) and orders by received_at DESC.
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_status_received
  ON public.pedimento_facturas (company_id, status, received_at DESC);

-- Hot path: /api/invoice-bank/[id] assignment lookup + reverse lookup
-- from a trafico to all assigned invoices.
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_assigned_trafico
  ON public.pedimento_facturas (company_id, assigned_to_trafico_id)
  WHERE assigned_to_trafico_id IS NOT NULL;

-- Hot path: tenant-scoped recent-first scans without a status filter
-- (used by /api/inbox + admin monitoring).
CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_received_at
  ON public.pedimento_facturas (company_id, received_at DESC);

-- Dedup indexes — same definitions as 20260422190000_invoice_dedup.sql.
-- Idempotent (CREATE INDEX IF NOT EXISTS), so running both migrations
-- in either order produces the same final state.

CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_file_hash
  ON public.pedimento_facturas (company_id, file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_company_norm_invoice
  ON public.pedimento_facturas (company_id, normalized_invoice_number)
  WHERE normalized_invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedimento_facturas_rfc_norm_invoice
  ON public.pedimento_facturas (company_id, supplier_rfc, normalized_invoice_number)
  WHERE supplier_rfc IS NOT NULL AND normalized_invoice_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Row-level security: FOR ALL USING (false).
-- Pattern per agent_actions / workflow_findings / lead_activities.
-- The portal uses an HMAC session (verifySession), not Supabase auth,
-- so no row matches the policy. The service role bypasses RLS, and
-- every read goes through the service-role client gated by
-- session.companyId at the app layer. The deny-all RLS policy is the
-- defense-in-depth wall: anon + non-service-role clients see zero rows.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pedimento_facturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedimento_facturas_deny_all ON public.pedimento_facturas;

CREATE POLICY pedimento_facturas_deny_all
  ON public.pedimento_facturas
  FOR ALL
  USING (false);

COMMENT ON POLICY pedimento_facturas_deny_all ON public.pedimento_facturas IS
  'Deny-all RLS — service-role bypasses. App layer is the primary gate via session.companyId. Pattern per .claude/rules/baseline.md I6.';

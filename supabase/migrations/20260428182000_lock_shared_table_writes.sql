-- =====================================================================
-- Tenant isolation P0 fix · Finding V2 (write surface) · shared tables
-- =====================================================================
-- Audit reference: ~/Desktop/audit-tenant-isolation-2026-04-28.md
--
-- The P0-A1 migration (20260428180000) does the heavy lift: it
-- REVOKEs ALL on every public table from anon, then re-GRANTs SELECT
-- on a 6-table whitelist of intentionally-public reference data.
-- That migration's run-order self-check guarantees zero anon write
-- privileges remain in `public` post-COMMIT.
--
-- This migration is defense-in-depth — explicit, named REVOKEs of
-- INSERT / UPDATE / DELETE on each of the 6 whitelist tables
-- individually. Three reasons to spell it out:
--
--   1. Future GRANTs are easier to spot in code review.
--      A reviewer scanning a future migration that does
--        `GRANT INSERT ON public.tariff_rates TO anon`
--      will notice the conflict with this file.
--
--   2. Defense against accidental re-grants. If a future Supabase
--      schema-restoration tool ever re-applies default privileges,
--      these explicit REVOKEs document the intent: "anon never
--      writes here, even though anon reads."
--
--   3. The whitelist set evolves. When future tables are added to
--      the public-read whitelist, the same REVOKE pattern lives
--      next to the GRANT — write-protection is opt-in by symmetry.
--
-- Idempotent (REVOKE IF EXISTS-style — REVOKE on absent grant is a
-- no-op). Self-check at end raises if any anon write privilege
-- survives anywhere in `public`.
--
-- Run order: 20260428180000 (anon revoke) → 20260428181000 (drop
-- permissive policies) → THIS (defensive shared-table write lock).
-- =====================================================================

BEGIN;

-- The whitelist must match P0-A1 (20260428180000_revoke_anon_privileges.sql).
-- Each table — confirmed via pg_class — has no tenant column. Reads stay
-- granted to anon for legitimate public-data flows; writes are revoked
-- explicitly here.
DO $$
DECLARE
  intentional_public TEXT[] := ARRAY[
    'bridge_times',         -- public bridge crossing wait times
    'bridge_wait_times',    -- public bridge wait time snapshots
    'tigie_fracciones',     -- Mexican tariff catalog
    'fracciones_kb',        -- fracción knowledge base
    'tariff_rates',         -- public tariff rate table
    'document_types'        -- reference enum of document types
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY intentional_public LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relkind='r' AND c.relname=t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
      RAISE NOTICE 'REVOKE write on public.% from anon', t;
    ELSE
      RAISE NOTICE 'SKIP: public.% does not exist (forward-compatible)', t;
    END IF;
  END LOOP;
END$$;

-- Self-check — abort if any anon write privilege survives in public.
-- This is the same invariant P0-A1 enforces post-COMMIT, re-asserted
-- here as the durable contract for any future migration that touches
-- the shared-table whitelist.
DO $$
DECLARE
  v_count INT;
  v_offenders TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(c.relname, ', ' ORDER BY c.relname)
  INTO v_count, v_offenders
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (has_table_privilege('anon', c.oid, 'INSERT')
         OR has_table_privilege('anon', c.oid, 'UPDATE')
         OR has_table_privilege('anon', c.oid, 'DELETE')
         OR has_table_privilege('anon', c.oid, 'TRUNCATE'));

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % tables still grant anon write: %', v_count, v_offenders;
  END IF;

  RAISE NOTICE 'PASS: zero anon write privileges in public schema';
END$$;

-- Self-check — confirm the whitelist still has the SELECT grant
-- intact (defense against an accidental REVOKE ALL elsewhere). This
-- is symmetric to the previous check: write-OFF, read-ON for the
-- whitelist.
DO $$
DECLARE
  intentional_public TEXT[] := ARRAY[
    'bridge_times','bridge_wait_times','tigie_fracciones',
    'fracciones_kb','tariff_rates','document_types'
  ];
  t TEXT;
  has_read BOOLEAN;
BEGIN
  FOREACH t IN ARRAY intentional_public LOOP
    SELECT has_table_privilege('anon', ('public.' || quote_ident(t))::regclass, 'SELECT')
    INTO has_read;
    IF NOT has_read AND EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname=t
    ) THEN
      RAISE EXCEPTION 'FAIL: whitelist table public.% lost anon SELECT grant', t;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: whitelist tables retain anon SELECT';
END$$;

COMMIT;

-- =====================================================================
-- Tenant isolation P0 fix · Finding V1+V2 (CRITICAL)
-- =====================================================================
-- Audit reference: ~/Desktop/audit-tenant-isolation-2026-04-28.md
--
-- Before this migration, every public.* table grants SELECT/INSERT/UPDATE/DELETE
-- to the `anon` role. The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is bundled
-- with every page of the deployed portal — anyone can extract it from view-source
-- and read or write 145 tables of tenant data through PostgREST. Live probes
-- on 2026-04-28 confirmed exfiltration of:
--   - tenants catalog (EVCO + MAFESA)
--   - partidas (pedimento 26 24 3596 5500003)
--   - compliance_events ("Auditoría Semanal EVCO")
--   - 290k globalpc_partidas, 64k globalpc_facturas, 126k documents
--
-- This migration:
--   1. Revokes ALL privileges from `anon` on every public table + sequence
--      + function. Default-deny.
--   2. Re-grants SELECT to `anon` on a small, hand-verified whitelist of
--      tables that are intentionally public reference data (no tenant column,
--      no PII).
--   3. Alters default privileges so any FUTURE table created in `public`
--      does not auto-grant to `anon`.
--   4. Includes a self-check at the end that RAISES on any tenant table
--      still readable by `anon`.
--
-- Notes on what this DOES NOT do (intentional, separate commits):
--   - Does not revoke from `authenticated`. The portal uses HMAC sessions,
--     not Supabase Auth, so `authenticated` is effectively unused. A separate
--     audit can lock that down later.
--   - Does not drop USING(true) RLS policies. Those are addressed in
--     20260428182000_drop_permissive_policies.sql (commit 5). On their own,
--     USING(true) policies are inert once the role lacks the underlying
--     SELECT grant — defense-in-depth.
--   - Does not migrate client components (calls/, calendario/, simulador/,
--     ~20 others) that read with the anon key. Those queries will return 401
--     after this migration. Internal-only deployment (Tito + Renato IV) means
--     the regression is acceptable; pages will be ported to /api/data in a
--     follow-up branch (see PR description).
-- =====================================================================

BEGIN;

-- 1. Revoke all DML on existing tables, sequences, functions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- 2. Set default privileges so newly-created tables don't auto-grant anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- 3. Hand-verified whitelist of intentionally-public reference tables.
--    Each was confirmed via pg_class to have no tenant column. If a row
--    in any of these tables ever needs tenant scoping in the future,
--    REMOVE it from this list and route reads through /api/data.
DO $$
DECLARE
  intentional_public TEXT[] := ARRAY[
    'bridge_times',         -- public bridge crossing wait times (no tenant)
    'bridge_wait_times',    -- public bridge wait time snapshots (no tenant)
    'tigie_fracciones',     -- Mexican tariff catalog (no tenant)
    'fracciones_kb',        -- fracción knowledge base (no tenant)
    'tariff_rates',         -- public tariff rate table (no tenant)
    'document_types'        -- reference enum of document types (no tenant)
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY intentional_public LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relkind='r' AND c.relname=t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
      RAISE NOTICE 'GRANT SELECT on public.% to anon', t;
    ELSE
      RAISE NOTICE 'SKIP: public.% does not exist (whitelist is forward-compatible)', t;
    END IF;
  END LOOP;
END$$;

-- 4. Self-check — abort the transaction if any table with a tenant column
--    still grants SELECT to anon. This is the regression guard.
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
    AND has_table_privilege('anon', c.oid, 'SELECT')
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.relname
        AND column_name IN ('company_id','clave_cliente','tenant_id','cve_cliente','client_id')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % tenant-scoped tables still grant anon SELECT: %', v_count, v_offenders;
  END IF;

  RAISE NOTICE 'PASS: zero tenant-scoped tables grant anon SELECT';
END$$;

-- 5. Self-check — confirm no anon write privileges anywhere in public.
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
         OR has_table_privilege('anon', c.oid, 'DELETE'));

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % tables still grant anon write: %', v_count, v_offenders;
  END IF;

  RAISE NOTICE 'PASS: zero anon write privileges in public schema';
END$$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- PORTAL · SEV-1 RLS deny-all · closes the anon-key cross-tenant leak
--
-- Apply: Monday 2026-04-20 · via Supabase SQL editor BEFORE Ursula's
-- 08:00 credential send. Blocking issue per
-- `.planning/tenant-isolation-audit-2026-04-19.md` (commit 7b3064f
-- on overnight/ursula-ready).
--
-- The problem: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is shipped to every
-- browser. Live probes on 2026-04-19 confirmed that key returns rows
-- from every tenant's `traficos`, `companies`, `expediente_documentos`,
-- and `globalpc_productos`. The portal's HMAC session is a UI gate
-- only — the database itself had no RLS enforcement on these tables.
-- Anyone who view-sources the portal, OR shares Ursula's browser, OR
-- gets the bundle, can read every customs record for every one of
-- the 51 active tenants under Patente 3596.
--
-- The fix: enable RLS + `FOR ALL USING (false)` on every tenant-scoped
-- table that isn't already covered. Service-role (used by every
-- portal `/api/*` endpoint via `createServerClient`) bypasses RLS
-- automatically — no portal code changes required.
--
-- Tables already RLS'd by prior migrations (no-op here, listed for
-- completeness):
--   · globalpc_productos     (20260417_parts_rls.sql)
--   · globalpc_partidas      (20260417_parts_rls.sql)
--   · classification_log     (20260417_parts_rls.sql)
--   · proveedor_rfc_cache    (20260418_proveedor_rfc_cache.sql)
--   · anexo24_partidas       (20260418_anexo24_parts.sql)
--   · audit_log              (20260407_pipeline_schema_foundation.sql)
--   · mensajeria_*           (20260505_mensajeria_phase1.sql)
--   · job_runs, bridge_times, surface_proposals, etc. (20260512_rls_b8)
--
-- Known casualty: any `'use client'` page using `NEXT_PUBLIC_SUPABASE_ANON_KEY`
-- directly will return empty after this lands. CLAUDE.md BUILD STATE
-- tracks one known case: `/pedimentos/nuevo` (operator-only, not
-- Ursula's path). If anything on the client surface breaks, route it
-- through `/api/data` or a dedicated `/api/*` endpoint using
-- `createServerClient`.
--
-- Pattern: idempotent — `IF to_regclass()` check skips missing tables;
-- `DROP POLICY IF EXISTS` + `CREATE POLICY` for re-runnability.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Ordered list of tenant-scoped tables that must deny anon access.
  -- Matches `.claude/rules/tenant-isolation.md` section "Tenant-scoped
  -- tables". Any new tenant-scoped table added after 2026-04-20 needs
  -- to append itself here AND to the rule file in the same PR.
  tables text[] := ARRAY[
    'traficos',                   -- Priority 1: confirmed exposed
    'companies',                  -- Priority 1: confirmed exposed
    'expediente_documentos',      -- Priority 1: confirmed exposed
    'entradas',                   -- Tenant-scoped per Block EE
    'globalpc_facturas',          -- Tenant-scoped per Block EE
    'globalpc_eventos',           -- Tenant-scoped per Block EE
    'globalpc_proveedores',       -- Tenant-scoped per Block EE
    'globalpc_contenedores',      -- Tenant-scoped per Block EE
    'globalpc_ordenes_carga',     -- Tenant-scoped per Block EE
    'globalpc_bultos',            -- Tenant-scoped per Block EE
    'pedimento_drafts',           -- Tenant-scoped per Block EE
    'pedimento_ocas',             -- Tenant-scoped per Block EE
    'pedimento_facturas',         -- Operator queue surface, tenant-scoped
    'sync_log',                   -- Per-tenant sync history
    'agent_decisions',            -- AI decision log, tenant-scoped
    'operational_decisions',      -- Same
    'operator_actions',           -- Ops audit trail, tenant-scoped
    'notifications',              -- Alerts, tenant-scoped
    'workflow_events',            -- Event bus, tenant-scoped
    'documento_solicitudes',      -- Doc request queue, tenant-scoped
    'invoices',                   -- Financial, tenant-scoped
    'compliance_predictions',     -- Tenant-scoped
    'mve_alerts',                 -- Tenant-scoped
    'client_profiles',            -- Per-tenant profile data
    'pedimentos',                -- 4,107 rows — SAT-audit record for Patente 3596
    'anexo24_partidas',          -- 1,793 rows — prior migration header claimed covered but live probe contradicts
    'supplier_network',          -- 101 rows — cross-tenant supplier intel
    'cruz_conversations',        -- 33 rows — every tenant's AI chat transcripts
    'system_config',             -- 7 rows — FX/DTA rates, lower sensitivity but deny
    'regulatory_alerts',         -- 3 rows — tenant-scoped alerts
        'client_briefings'            -- Morning briefing per tenant
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      -- Enable RLS. Idempotent.
      EXECUTE 'ALTER TABLE ' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY';
      -- Drop + create the deny-all policy by a stable name so re-runs
      -- don't produce duplicate policies.
      EXECUTE 'DROP POLICY IF EXISTS '     || quote_ident(t || '_deny_anon') || ' ON ' || quote_ident(t);
      EXECUTE 'CREATE POLICY '             || quote_ident(t || '_deny_anon') ||
              ' ON ' || quote_ident(t) ||
              ' FOR ALL USING (false)';
      RAISE NOTICE '%: RLS enabled + deny-all policy applied', t;
    ELSE
      RAISE NOTICE '%: skipped (table not present in this environment)', t;
    END IF;
  END LOOP;
END
$$;

-- Post-apply verification queries (run in SQL editor after this
-- migration). Every one must return the expected result:
--
--   -- 1. RLS is enabled on all target tables:
--   SELECT relname, relrowsecurity
--     FROM pg_class
--    WHERE relname IN (
--      'traficos','companies','expediente_documentos','entradas',
--      'globalpc_facturas','globalpc_eventos','globalpc_proveedores',
--      'globalpc_contenedores','globalpc_ordenes_carga','globalpc_bultos',
--      'pedimento_drafts','pedimento_ocas','pedimento_facturas',
--      'sync_log','agent_decisions','operational_decisions',
--      'operator_actions','notifications','workflow_events',
--      'documento_solicitudes','invoices','compliance_predictions',
--      'mve_alerts','client_profiles','client_briefings'
--    )
--   ORDER BY relname;
--   -- Expected: every row shows relrowsecurity = true.
--
--   -- 2. Deny-all policies exist:
--   SELECT schemaname, tablename, policyname, cmd, qual
--     FROM pg_policies
--    WHERE policyname LIKE '%_deny_anon'
--   ORDER BY tablename;
--   -- Expected: one row per covered table with qual = 'false'.
--
--   -- 3. Anon probe denied (run from a separate client using the
--   --    NEXT_PUBLIC_SUPABASE_ANON_KEY, NOT the service role):
--   --    SELECT from traficos, companies, expediente_documentos,
--   --    globalpc_productos.
--   --    Expected: empty result set OR 401 permission_denied
--   --    (NOT: rows returned).
--
-- Portal smoke-test after apply (do this before the credential send):
--   · /inicio  — should load normally (service-role paths)
--   · /embarques — should load
--   · /embarques/[id] — should load
--   · /catalogo — should load (now filtered by active-parts allowlist)
--   · /pedimentos/nuevo — EXPECTED TO BREAK (operator-only, known
--     debt per CLAUDE.md BUILD STATE "Known debt" section)

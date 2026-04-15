-- ═══════════════════════════════════════════════════════════════
-- ZAPATA AI · B8 — RLS enablement for tables that shipped without it
--
-- Audit on 2026-04-15 identified 9 tables created in earlier migrations
-- that never had ROW LEVEL SECURITY enabled. Service-role bypasses RLS
-- so there was no active leak, but defense-in-depth requires policies
-- on every table.
--
-- Resilient: each block checks `to_regclass(...)` first so tables that
-- were never created on a particular environment are silently skipped
-- instead of aborting the migration. Idempotent: DROP IF EXISTS + CREATE
-- on every policy.
--
-- Policy shape legend:
--   • TENANT_SCOPED       — company_id = current_setting('app.company_id')
--                            OR role in (operator,admin,broker)
--   • OPERATOR_ONLY       — role in (operator,admin,broker) only
--   • AUTHENTICATED_READ  — any authenticated session can SELECT
--                            (reference data — bridges, carriers)
--   • SERVICE_ROLE_ONLY   — no policies → only service_role bypasses RLS
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  -- ── bridge_times (reference data — authenticated read) ──
  IF to_regclass('public.bridge_times') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE bridge_times ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS bridge_times_authenticated_read ON bridge_times';
    EXECUTE 'CREATE POLICY bridge_times_authenticated_read ON bridge_times FOR SELECT USING (true)';
    RAISE NOTICE 'bridge_times: RLS enabled';
  ELSE
    RAISE NOTICE 'bridge_times: skipped (table not present)';
  END IF;

  -- ── job_runs (infrastructure — service-role only) ──
  IF to_regclass('public.job_runs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'job_runs: RLS enabled (no policies = service-role only)';
  ELSE
    RAISE NOTICE 'job_runs: skipped (table not present)';
  END IF;

  -- ── surface_proposals (tenant-scoped) ──
  IF to_regclass('public.surface_proposals') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE surface_proposals ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS surface_proposals_tenant_read ON surface_proposals';
    EXECUTE $POL$
      CREATE POLICY surface_proposals_tenant_read ON surface_proposals
        FOR SELECT USING (
          company_id = current_setting('app.company_id', true)
          OR current_setting('app.role', true) IN ('operator','admin','broker')
        )
    $POL$;
    RAISE NOTICE 'surface_proposals: RLS enabled';
  ELSE
    RAISE NOTICE 'surface_proposals: skipped (table not present)';
  END IF;

  -- ── proposal_generation_log (service-role only) ──
  IF to_regclass('public.proposal_generation_log') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE proposal_generation_log ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'proposal_generation_log: RLS enabled (service-role only)';
  ELSE
    RAISE NOTICE 'proposal_generation_log: skipped (table not present)';
  END IF;

  -- ── notifications (tenant or recipient scoped) ──
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS notifications_tenant_or_recipient_read ON notifications';
    EXECUTE $POL$
      CREATE POLICY notifications_tenant_or_recipient_read ON notifications
        FOR SELECT USING (
          company_id = current_setting('app.company_id', true)
          OR recipient_id::text = current_setting('app.user_id', true)
          OR current_setting('app.role', true) IN ('operator','admin','broker')
        )
    $POL$;
    RAISE NOTICE 'notifications: RLS enabled';
  ELSE
    RAISE NOTICE 'notifications: skipped (table not present)';
  END IF;

  -- ── shift_handoffs (operator-only) ──
  IF to_regclass('public.shift_handoffs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE shift_handoffs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS shift_handoffs_operator_read ON shift_handoffs';
    EXECUTE $POL$
      CREATE POLICY shift_handoffs_operator_read ON shift_handoffs
        FOR SELECT USING (
          current_setting('app.role', true) IN ('operator','admin','broker')
        )
    $POL$;
    RAISE NOTICE 'shift_handoffs: RLS enabled';
  ELSE
    RAISE NOTICE 'shift_handoffs: skipped (table not present)';
  END IF;

  -- ── client_issues (tenant-scoped) ──
  IF to_regclass('public.client_issues') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE client_issues ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS client_issues_tenant_read ON client_issues';
    EXECUTE $POL$
      CREATE POLICY client_issues_tenant_read ON client_issues
        FOR SELECT USING (
          company_id = current_setting('app.company_id', true)
          OR current_setting('app.role', true) IN ('operator','admin','broker')
        )
    $POL$;
    RAISE NOTICE 'client_issues: RLS enabled';
  ELSE
    RAISE NOTICE 'client_issues: skipped (table not present)';
  END IF;

  -- ── transportistas (shared carrier pool — authenticated read) ──
  IF to_regclass('public.transportistas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE transportistas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS transportistas_authenticated_read ON transportistas';
    EXECUTE 'CREATE POLICY transportistas_authenticated_read ON transportistas FOR SELECT USING (true)';
    RAISE NOTICE 'transportistas: RLS enabled';
  ELSE
    RAISE NOTICE 'transportistas: skipped (table not present)';
  END IF;

  -- ── trafico_carrier_assignments (operator-only) ──
  IF to_regclass('public.trafico_carrier_assignments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE trafico_carrier_assignments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS trafico_carrier_assignments_operator_read ON trafico_carrier_assignments';
    EXECUTE $POL$
      CREATE POLICY trafico_carrier_assignments_operator_read ON trafico_carrier_assignments
        FOR SELECT USING (
          current_setting('app.role', true) IN ('operator','admin','broker')
        )
    $POL$;
    RAISE NOTICE 'trafico_carrier_assignments: RLS enabled';
  ELSE
    RAISE NOTICE 'trafico_carrier_assignments: skipped (table not present)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Post-migration audit: which tables actually got RLS enabled?
--
--   SELECT c.relname, c.relrowsecurity
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public'
--     AND c.relname IN (
--       'bridge_times', 'job_runs', 'surface_proposals',
--       'proposal_generation_log', 'notifications', 'shift_handoffs',
--       'client_issues', 'transportistas', 'trafico_carrier_assignments'
--     )
--   ORDER BY c.relname;
-- ═══════════════════════════════════════════════════════════════

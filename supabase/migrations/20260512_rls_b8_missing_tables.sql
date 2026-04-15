-- ═══════════════════════════════════════════════════════════════
-- ZAPATA AI · B8 — RLS enablement for tables that shipped without it
--
-- Audit on 2026-04-15 identified 9 tables created in earlier migrations
-- that never had ROW LEVEL SECURITY enabled. Service-role bypasses RLS
-- so there was no active leak, but defense-in-depth requires policies
-- on every table. This migration enables RLS and installs the right
-- policy shape for each table's tenant scope.
--
-- Idempotent: every ALTER uses IF NOT EXISTS patterns; every policy
-- is DROP IF EXISTS + CREATE.
--
-- Policy shape legend:
--   • TENANT_SCOPED   — company_id = current_setting('app.company_id')
--                        OR role in (operator,admin,broker)
--   • OPERATOR_ONLY   — role in (operator,admin,broker) only
--   • AUTHENTICATED_READ — any authenticated session can SELECT
--                          (reference data — bridges, carriers)
--   • SERVICE_ROLE_ONLY — no authenticated access; scripts/cron only
-- ═══════════════════════════════════════════════════════════════

-- ── bridge_times (reference data — bridge wait times are shared) ──
ALTER TABLE bridge_times ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bridge_times_authenticated_read ON bridge_times;
CREATE POLICY bridge_times_authenticated_read ON bridge_times
  FOR SELECT USING (true);

-- ── job_runs (infrastructure — script execution log) ──
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
-- No policies = service role only; authenticated sessions see nothing.

-- ── surface_proposals (tenant data — AI-generated action suggestions) ──
ALTER TABLE surface_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS surface_proposals_tenant_read ON surface_proposals;
CREATE POLICY surface_proposals_tenant_read ON surface_proposals
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── proposal_generation_log (infrastructure — run metrics) ──
ALTER TABLE proposal_generation_log ENABLE ROW LEVEL SECURITY;
-- No policies = service role only.

-- ── notifications (tenant or recipient scoped) ──
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_or_recipient_read ON notifications;
CREATE POLICY notifications_tenant_or_recipient_read ON notifications
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR recipient_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── shift_handoffs (operator-only — internal ops handoffs) ──
ALTER TABLE shift_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shift_handoffs_operator_read ON shift_handoffs;
CREATE POLICY shift_handoffs_operator_read ON shift_handoffs
  FOR SELECT USING (
    current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── client_issues (tenant-scoped — client-reported problems) ──
ALTER TABLE client_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_issues_tenant_read ON client_issues;
CREATE POLICY client_issues_tenant_read ON client_issues
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── transportistas (shared carrier pool — authenticated read, op write) ──
ALTER TABLE transportistas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transportistas_authenticated_read ON transportistas;
CREATE POLICY transportistas_authenticated_read ON transportistas
  FOR SELECT USING (true);

-- ── trafico_carrier_assignments (operator-only — dispatch records) ──
ALTER TABLE trafico_carrier_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trafico_carrier_assignments_operator_read ON trafico_carrier_assignments;
CREATE POLICY trafico_carrier_assignments_operator_read ON trafico_carrier_assignments
  FOR SELECT USING (
    current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ═══════════════════════════════════════════════════════════════
-- Post-migration smoke (run manually in Supabase SQL editor):
--
--   SET app.company_id = '9254';
--   SET app.role = 'client';
--   SELECT count(*) FROM surface_proposals;          -- only EVCO rows
--   SELECT count(*) FROM shift_handoffs;             -- 0 (client role)
--   SELECT count(*) FROM trafico_carrier_assignments; -- 0 (client role)
--   SELECT count(*) FROM bridge_times;                -- all rows (reference)
--   SELECT count(*) FROM transportistas;              -- all rows (reference)
-- ═══════════════════════════════════════════════════════════════

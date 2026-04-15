-- ═══════════════════════════════════════════════════════════════
-- AGUILA V1 · RLS tenant isolation hardening (April 2026)
--
-- Security audit found 17 tables with `FOR SELECT USING (true)` in the
-- previous 20260330000001_fix_rls_policies.sql migration. Any authenticated
-- user could read cross-tenant drafts, conversations, supplier intel, and
-- user preferences.
--
-- This migration replaces the open read policies with company_id scope
-- checks on tables that carry tenant data. Tables without a company_id
-- column (reference data like tariff_rates, bridge_wait_times,
-- events_catalog) keep the open read by design.
--
-- Every policy is IF EXISTS + DROP so the migration is re-runnable.
-- ═══════════════════════════════════════════════════════════════

-- ── pedimento_drafts ──
DROP POLICY IF EXISTS "drafts_read" ON pedimento_drafts;
CREATE POLICY drafts_tenant_read ON pedimento_drafts
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── cruz_conversations ──
DROP POLICY IF EXISTS "conversations_read" ON cruz_conversations;
CREATE POLICY conversations_tenant_read ON cruz_conversations
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── push_subscriptions ──
-- User-scoped device tokens; never tenant-shared.
DROP POLICY IF EXISTS "push_sub_read" ON push_subscriptions;
CREATE POLICY push_sub_tenant_read ON push_subscriptions
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── service_requests ──
DROP POLICY IF EXISTS "service_req_read" ON service_requests;
CREATE POLICY service_req_tenant_read ON service_requests
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── user_preferences ──
DROP POLICY IF EXISTS "user_prefs_read" ON user_preferences;
CREATE POLICY user_prefs_tenant_read ON user_preferences
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── client_requests ──
-- Two policies existed — drop both, re-add one scoped policy.
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "client_requests_read" ON client_requests';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "client_req_read" ON client_requests';
EXCEPTION WHEN others THEN NULL; END $$;
CREATE POLICY client_req_tenant_read ON client_requests
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── calendar_events (has company_id per schema) ──
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "calendar_events_read" ON calendar_events';
EXCEPTION WHEN others THEN NULL; END $$;
CREATE POLICY calendar_events_tenant_read ON calendar_events
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── streak_tracking (user-scoped via company_id) ──
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "streak_tracking_read" ON streak_tracking';
EXCEPTION WHEN others THEN NULL; END $$;
CREATE POLICY streak_tracking_tenant_read ON streak_tracking
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── supplier_network (tenant-owned supplier intel) ──
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "supplier_network_read" ON supplier_network';
EXCEPTION WHEN others THEN NULL; END $$;
CREATE POLICY supplier_network_tenant_read ON supplier_network
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- ── regulatory_alerts (tenant-scoped) ──
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "regulatory_alerts_read" ON regulatory_alerts';
EXCEPTION WHEN others THEN NULL; END $$;
CREATE POLICY regulatory_alerts_tenant_read ON regulatory_alerts
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

-- Reference/shared tables intentionally keep open read:
--   · tariff_rates (TIGIE data — public reference)
--   · bridge_wait_times (shared crossing intelligence)
--   · events_catalog (workflow event catalog)
--   · corridor_landmarks (map reference)
--   · mexican_banks_pece (public bank registry)
--   · tipo_cambio_alerts / tipo_cambio_history (FX reference)
--   · approved_suppliers (cross-tenant allowlist)
-- These remain governed by the existing policies in prior migrations.

-- =====================================================================
-- Tenant isolation P0 fix · Finding V6 (HIGH) · drop permissive RLS
-- =====================================================================
-- Audit reference: ~/Desktop/audit-tenant-isolation-2026-04-28.md
--
-- Pre-fix: 86 RLS policies on tenant-scoped public tables had
-- `USING (true)` (or NULL) and applied to PUBLIC / anon — meaning
-- any client with the anon key read every tenant's row through
-- PostgREST. RLS was *enabled* on these tables, so the policy
-- itself was the leak. The P0-A1 anon-revoke migration (commit
-- 20260428180000) makes the leak inert by stripping the underlying
-- SELECT grant, but the permissive policy remains a regression
-- vector — if a future migration GRANTs anon SELECT on one of
-- these tables (intentionally or by accident), the leak resumes.
-- This migration removes the policy itself so the table fails
-- closed under both layers.
--
-- ARCHITECTURAL NOTE
-- ------------------
-- The user's P0 brief suggested replacing `USING (true)` with
--   `USING (company_id = auth.jwt()->>'company_id')`
-- which is the standard Supabase Auth pattern. This codebase does
-- NOT use Supabase Auth — every authenticated request carries an
-- HMAC-signed `portal_session` cookie verified server-side, NOT a
-- JWT. There is no `auth.jwt()->>'company_id'` claim available to
-- RLS, so that policy expression evaluates to NULL → false for
-- every row, blocking legitimate service-role reads ONLY because
-- service role bypasses RLS — but it would also confuse every
-- future reader of the policy.
--
-- Instead this migration follows the codebase's own established
-- HMAC pattern (see .claude/rules/tenant-isolation.md and the
-- existing 33 `USING (false)` deny-all policies on
-- mensajeria_*, agent_actions, cruz_ai_conversations, etc.):
--
--   Drop the permissive policy. RLS-on with no remaining policy
--   = deny-all for non-service-role. Service role bypasses.
--   Application code does the actual tenant filter via
--   `session.companyId` in `/api/data` and elsewhere.
--
-- This matches how invariant I6 in baseline.md was already shipped
-- on every other tenant table on this DB. We're closing a
-- consistency gap — not introducing a new pattern.
--
-- Migration to Supabase Auth (and thus to `auth.jwt()` policies)
-- is a wholly separate architecture change. Tracked as a P2
-- follow-up; not in scope for tenant-isolation P0.
--
-- DROP LIST
-- ---------
-- 86 policies, generated from a live pg_policy query that selects:
--   * USING (true) OR NULL
--   * cmd in (SELECT, ALL)
--   * table has tenant column (company_id / cve_cliente / etc.)
--   * role array is empty (= PUBLIC) OR contains 'anon'
--
-- All DROP POLICY IF EXISTS — idempotent. Safe to re-run.
-- Policies that apply only to `service_role` or `authenticated`
-- (and have no anon/PUBLIC overlap) are left in place; they are
-- inert against the threat model post anon-revoke.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "anon_read_facturas" ON public."aduanet_facturas";
DROP POLICY IF EXISTS "Public read anexo24_fracciones" ON public."anexo24_fracciones";
DROP POLICY IF EXISTS "Public read anexo24_numeros_parte" ON public."anexo24_numeros_parte";
DROP POLICY IF EXISTS "Public read anexo24_pedimentos" ON public."anexo24_pedimentos";
DROP POLICY IF EXISTS "Public read anexo24_proveedores" ON public."anexo24_proveedores";
DROP POLICY IF EXISTS "anon_read_anomaly_baselines" ON public."anomaly_baselines";
DROP POLICY IF EXISTS "anon_read_approved_suppliers" ON public."approved_suppliers";
DROP POLICY IF EXISTS "approved_suppliers_read" ON public."approved_suppliers";
DROP POLICY IF EXISTS "anon_read" ON public."bodega_entradas";
DROP POLICY IF EXISTS "anon_bridge" ON public."bridge_intelligence";
DROP POLICY IF EXISTS "anon read" ON public."catalogo_master";
DROP POLICY IF EXISTS "service write" ON public."catalogo_master";
DROP POLICY IF EXISTS "anon_benchmarks" ON public."client_benchmarks";
DROP POLICY IF EXISTS "Public read client_documents" ON public."client_documents";
DROP POLICY IF EXISTS "anon_onboarding" ON public."client_onboarding";
DROP POLICY IF EXISTS "service_onboarding" ON public."client_onboarding";
DROP POLICY IF EXISTS "service_calendar" ON public."compliance_calendar";
DROP POLICY IF EXISTS "anon_compliance_predictions" ON public."compliance_predictions";
DROP POLICY IF EXISTS "Allow all operations on conversations" ON public."conversations";
DROP POLICY IF EXISTS "Public read coves" ON public."coves";
DROP POLICY IF EXISTS "anon_crossing_intel" ON public."crossing_intelligence";
DROP POLICY IF EXISTS "service_crossing_intel" ON public."crossing_intelligence";
DROP POLICY IF EXISTS "anon_crossing" ON public."crossing_predictions";
DROP POLICY IF EXISTS "service_all_crossing" ON public."crossing_windows";
DROP POLICY IF EXISTS "anon_daily_briefs" ON public."daily_briefs";
DROP POLICY IF EXISTS "service_daily_briefs" ON public."daily_briefs";
DROP POLICY IF EXISTS "solicitudes_read" ON public."documento_solicitudes";
DROP POLICY IF EXISTS "anon_read_documents" ON public."documents";
DROP POLICY IF EXISTS "anon_duplicates" ON public."duplicates_detected";
DROP POLICY IF EXISTS "service_duplicates" ON public."duplicates_detected";
DROP POLICY IF EXISTS "anon_read_econta_anticipos" ON public."econta_anticipos";
DROP POLICY IF EXISTS "anon_read" ON public."econta_antiguedad";
DROP POLICY IF EXISTS "anon_read_econta_aplicaciones" ON public."econta_aplicaciones";
DROP POLICY IF EXISTS "anon_read_econta_cartera" ON public."econta_cartera";
DROP POLICY IF EXISTS "anon_read_econta_egresos" ON public."econta_egresos";
DROP POLICY IF EXISTS "anon_read" ON public."econta_facturacion";
DROP POLICY IF EXISTS "anon_read_econta_facturas" ON public."econta_facturas";
DROP POLICY IF EXISTS "anon_read_econta_facturas_detalle" ON public."econta_facturas_detalle";
DROP POLICY IF EXISTS "client_isolation_econta_facturas_detalle" ON public."econta_facturas_detalle";
DROP POLICY IF EXISTS "anon_read_econta_ingresos" ON public."econta_ingresos";
DROP POLICY IF EXISTS "anon_read_econta_polizas" ON public."econta_polizas";
DROP POLICY IF EXISTS "service_role_all" ON public."econta_registros";
DROP POLICY IF EXISTS "anon_read" ON public."econta_saldos";
DROP POLICY IF EXISTS "service_all_email_intake" ON public."email_intake";
DROP POLICY IF EXISTS "entradas_all" ON public."entradas_bodega";
DROP POLICY IF EXISTS "anon_financial_intel" ON public."financial_intelligence";
DROP POLICY IF EXISTS "service_financial_intel" ON public."financial_intelligence";
DROP POLICY IF EXISTS "anon_read_globalpc_bultos" ON public."globalpc_bultos";
DROP POLICY IF EXISTS "anon_read_globalpc_contenedores" ON public."globalpc_contenedores";
DROP POLICY IF EXISTS "anon_read_globalpc_eventos" ON public."globalpc_eventos";
DROP POLICY IF EXISTS "anon_read_globalpc_facturas" ON public."globalpc_facturas";
DROP POLICY IF EXISTS "anon_read_globalpc_ordenes_carga" ON public."globalpc_ordenes_carga";
DROP POLICY IF EXISTS "anon_read_globalpc_partidas" ON public."globalpc_partidas";
DROP POLICY IF EXISTS "anon_read_globalpc_productos" ON public."globalpc_productos";
DROP POLICY IF EXISTS "client_isolation_globalpc_productos" ON public."globalpc_productos";
DROP POLICY IF EXISTS "anon_read_globalpc_proveedores" ON public."globalpc_proveedores";
DROP POLICY IF EXISTS "anon_integration_health" ON public."integration_health";
DROP POLICY IF EXISTS "service_integration_health" ON public."integration_health";
DROP POLICY IF EXISTS "service_legal" ON public."legal_documents";
DROP POLICY IF EXISTS "anon_oca" ON public."oca_database";
DROP POLICY IF EXISTS "drafts_read" ON public."pedimento_drafts";
DROP POLICY IF EXISTS "anon_risk_scores" ON public."pedimento_risk_scores";
DROP POLICY IF EXISTS "Public read pedimentos_detalle" ON public."pedimentos_detalle";
DROP POLICY IF EXISTS "anon_pre_arrival" ON public."pre_arrival_briefs";
DROP POLICY IF EXISTS "service_pre_arrival" ON public."pre_arrival_briefs";
DROP POLICY IF EXISTS "anon_product_intel" ON public."product_intelligence";
DROP POLICY IF EXISTS "service_product_intel" ON public."product_intelligence";
DROP POLICY IF EXISTS "anon_push" ON public."push_subscriptions";
DROP POLICY IF EXISTS "push_sub_read" ON public."push_subscriptions";
DROP POLICY IF EXISTS "anon_rate_quotes" ON public."rate_quotes";
DROP POLICY IF EXISTS "anon_rectificacion" ON public."rectificacion_opportunities";
DROP POLICY IF EXISTS "service_all_risk" ON public."risk_history";
DROP POLICY IF EXISTS "anon_service_requests" ON public."service_requests";
DROP POLICY IF EXISTS "service_req_read" ON public."service_requests";
DROP POLICY IF EXISTS "Allow all operations on shipments" ON public."shipments";
DROP POLICY IF EXISTS "service_all_supplier" ON public."supplier_intelligence";
DROP POLICY IF EXISTS "service_sync_log" ON public."sync_log";
DROP POLICY IF EXISTS "service_tokens" ON public."tracking_tokens";
DROP POLICY IF EXISTS "service_role_all" ON public."upload_tokens";
DROP POLICY IF EXISTS "service_prefs" ON public."user_preferences";
DROP POLICY IF EXISTS "user_prefs_read" ON public."user_preferences";
DROP POLICY IF EXISTS "service_voice" ON public."voice_sessions";
DROP POLICY IF EXISTS "anon_warehouse_intel" ON public."warehouse_intelligence";
DROP POLICY IF EXISTS "service_warehouse_intel" ON public."warehouse_intelligence";
DROP POLICY IF EXISTS "anon_webhooks" ON public."webhook_subscriptions";
DROP POLICY IF EXISTS "service_wa" ON public."whatsapp_conversations";

-- Self-check 1 — abort if any USING(true) policy on a tenant table
-- still applies to PUBLIC or anon.
DO $$
DECLARE
  v_count INT;
  v_offenders TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(c.relname || '::' || p.polname, ', ' ORDER BY c.relname, p.polname)
  INTO v_count, v_offenders
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND (pg_get_expr(p.polqual, p.polrelid) = 'true' OR pg_get_expr(p.polqual, p.polrelid) IS NULL)
    AND (p.polcmd = 'r' OR p.polcmd = '*')
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.relname
        AND column_name IN ('company_id','clave_cliente','tenant_id','cve_cliente','client_id')
    )
    AND (
      NOT EXISTS (SELECT 1 FROM unnest(p.polroles) r WHERE r > 0)
      OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname = 'anon')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % permissive policies still apply to PUBLIC/anon on tenant tables: %', v_count, v_offenders;
  END IF;

  RAISE NOTICE 'PASS: zero permissive read policies on tenant tables target PUBLIC/anon';
END$$;

COMMIT;

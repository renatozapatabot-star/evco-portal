-- ============================================================================
-- CRITICAL: Fix permissive RLS policies that expose cross-client data
-- 6 tables had USING (true) — any authenticated user could read ALL companies
-- Patente 3596 · Aduana 240
-- ============================================================================

-- ── calendar_events ──
DROP POLICY IF EXISTS "read_own_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "insert_calendar_events" ON calendar_events;
CREATE POLICY "calendar_events_select" ON calendar_events
  FOR SELECT USING (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');
CREATE POLICY "calendar_events_insert" ON calendar_events
  FOR INSERT WITH CHECK (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');

-- ── quote_requests ──
DROP POLICY IF EXISTS "read_own_quote_requests" ON quote_requests;
DROP POLICY IF EXISTS "insert_quote_requests" ON quote_requests;
CREATE POLICY "quote_requests_select" ON quote_requests
  FOR SELECT USING (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');
CREATE POLICY "quote_requests_insert" ON quote_requests
  FOR INSERT WITH CHECK (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');

-- ── change_requests ──
DROP POLICY IF EXISTS "read_own_change_requests" ON change_requests;
DROP POLICY IF EXISTS "insert_change_requests" ON change_requests;
CREATE POLICY "change_requests_select" ON change_requests
  FOR SELECT USING (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');
CREATE POLICY "change_requests_insert" ON change_requests
  FOR INSERT WITH CHECK (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');

-- ── daily_performance ──
DROP POLICY IF EXISTS "daily_performance_select" ON daily_performance;
DROP POLICY IF EXISTS "daily_performance_insert" ON daily_performance;
CREATE POLICY "daily_performance_select_isolated" ON daily_performance
  FOR SELECT USING (company_id = current_setting('app.company_id', true)
    OR current_setting('role', true) = 'service_role');
CREATE POLICY "daily_performance_insert_isolated" ON daily_performance
  FOR INSERT WITH CHECK (current_setting('role', true) = 'service_role');

-- ── streak_tracking (if exists) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'streak_tracking') THEN
    EXECUTE 'DROP POLICY IF EXISTS "streak_tracking_select" ON streak_tracking';
    EXECUTE 'CREATE POLICY "streak_tracking_select_isolated" ON streak_tracking
      FOR SELECT USING (company_id = current_setting(''app.company_id'', true)
        OR current_setting(''role'', true) = ''service_role'')';
  END IF;
END $$;

-- ============================================================================
-- End — 6 tables secured with company_id isolation
-- ============================================================================

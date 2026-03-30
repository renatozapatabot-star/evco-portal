-- Fix overly permissive RLS policies
-- Audit finding: 17 tables had FOR ALL USING (true)
-- Fix: restrict writes to service_role, keep reads open for authenticated

-- 1. Add RLS to unprotected tables
ALTER TABLE IF EXISTS approved_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tipo_cambio_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tipo_cambio_history ENABLE ROW LEVEL SECURITY;

-- 2. Fix pedimento_drafts — restrict writes to service_role
DROP POLICY IF EXISTS "Allow all for pedimento_drafts" ON pedimento_drafts;
CREATE POLICY "drafts_service_write" ON pedimento_drafts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "drafts_service_update" ON pedimento_drafts
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "drafts_read" ON pedimento_drafts
  FOR SELECT USING (true);

-- 3. Fix cruz_conversations — restrict writes to service_role
DROP POLICY IF EXISTS "Allow all for cruz_conversations" ON cruz_conversations;
CREATE POLICY "conversations_service_write" ON cruz_conversations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "conversations_service_update" ON cruz_conversations
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "conversations_read" ON cruz_conversations
  FOR SELECT USING (true);

-- 4. Fix push_subscriptions
DROP POLICY IF EXISTS "Allow all for push_subscriptions" ON push_subscriptions;
CREATE POLICY "push_sub_service_write" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "push_sub_read" ON push_subscriptions
  FOR SELECT USING (true);

-- 5. Fix service_requests
DROP POLICY IF EXISTS "Allow all for service_requests" ON service_requests;
CREATE POLICY "service_req_write" ON service_requests
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_req_read" ON service_requests
  FOR SELECT USING (true);

-- 6. Fix user_preferences
DROP POLICY IF EXISTS "Allow all for user_preferences" ON user_preferences;
CREATE POLICY "user_prefs_service_write" ON user_preferences
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "user_prefs_read" ON user_preferences
  FOR SELECT USING (true);

-- 7. Fix webhook_subscriptions
DROP POLICY IF EXISTS "Allow all for webhook_subscriptions" ON webhook_subscriptions;
CREATE POLICY "webhook_sub_service" ON webhook_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Fix webhook_deliveries
DROP POLICY IF EXISTS "Allow all for webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "webhook_del_service" ON webhook_deliveries
  FOR ALL USING (auth.role() = 'service_role');

-- 9. Policies for newly protected tables
CREATE POLICY "approved_suppliers_read" ON approved_suppliers
  FOR SELECT USING (true);
CREATE POLICY "approved_suppliers_write" ON approved_suppliers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "tipo_cambio_alerts_read" ON tipo_cambio_alerts
  FOR SELECT USING (true);
CREATE POLICY "tipo_cambio_alerts_write" ON tipo_cambio_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "tipo_cambio_history_read" ON tipo_cambio_history
  FOR SELECT USING (true);
CREATE POLICY "tipo_cambio_history_write" ON tipo_cambio_history
  FOR ALL USING (auth.role() = 'service_role');

-- NOTE: Run this migration via Supabase dashboard SQL editor
-- or via: npx supabase db push
-- Verify with: SELECT tablename, policyname FROM pg_policies ORDER BY tablename;

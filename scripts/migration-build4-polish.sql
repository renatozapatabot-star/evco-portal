-- BUILD 4 — POLISH LAYER MIGRATIONS
-- Run in Supabase SQL Editor before deploying

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT,
  user_identifier TEXT,
  default_filter TEXT DEFAULT 'all',
  default_sort TEXT DEFAULT 'score',
  default_sort_dir TEXT DEFAULT 'desc',
  preferred_language TEXT DEFAULT 'es',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  dark_mode BOOLEAN DEFAULT FALSE,
  items_per_page INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_prefs" ON user_preferences FOR ALL USING (true);

-- Companies table additions
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_question_at TIMESTAMPTZ;

-- Sync log for data freshness tracking
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT,
  sync_type TEXT,
  rows_synced INTEGER,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_sync_log" ON sync_log FOR ALL USING (true);

-- Legal documents tracker
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL,
  client_name TEXT,
  company_id TEXT,
  issued_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'verify',
  notes TEXT,
  responsible TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_legal_docs" ON legal_documents FOR ALL USING (true);

-- CRUZ conversation audit log
CREATE TABLE IF NOT EXISTS cruz_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT,
  user_role TEXT,
  query TEXT,
  response TEXT,
  tools_used JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cruz_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_cruz_conv" ON cruz_conversations FOR ALL USING (true);

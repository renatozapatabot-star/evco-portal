-- ADUANA Gap Closer — notification preferences + client users
-- Run in Supabase SQL Editor

-- 1. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id TEXT,
  channel TEXT CHECK (channel IN ('portal','email','telegram','whatsapp')),
  event_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_type, channel)
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Client Users (multi-user per company)
CREATE TABLE IF NOT EXISTS client_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  company_id TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  invited_by UUID,
  last_login TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_users_company ON client_users(company_id);
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

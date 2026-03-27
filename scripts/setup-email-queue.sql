-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  to_address TEXT NOT NULL,
  cc_address TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  attachments JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending_approval',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by VARCHAR(100),
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  tenant_slug VARCHAR(50) DEFAULT 'evco'
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_email_queue" ON email_queue;
DROP POLICY IF EXISTS "anon_read_email_queue" ON email_queue;
CREATE POLICY "service_role_email_queue" ON email_queue FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_email_queue" ON email_queue FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);

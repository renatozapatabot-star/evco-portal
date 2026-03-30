-- CRUZ Portal Migrations — March 27, 2026
-- Run in Supabase SQL Editor before deploying

-- BUILD 2: Call Transcripts
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT,
  transcribed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER,
  language TEXT DEFAULT 'es',
  summary TEXT,
  full_transcript TEXT,
  action_items JSONB,
  traficos_mentioned TEXT[],
  follow_up_email TEXT,
  company_id TEXT DEFAULT 'evco'
);

-- BUILD 5: Compliance Events
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  event_type TEXT,
  severity TEXT DEFAULT 'medium',
  company_id TEXT DEFAULT 'evco',
  telegram_reminder BOOLEAN DEFAULT TRUE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUILD 6: Pedimento Drafts
CREATE TABLE IF NOT EXISTS pedimento_drafts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trafico_id TEXT,
  draft_data JSONB,
  status TEXT DEFAULT 'draft',
  created_by TEXT DEFAULT 'CRUZ',
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed compliance events
INSERT INTO compliance_events (title, due_date, event_type, severity) VALUES
('Auditoria Semanal EVCO', CURRENT_DATE + 7, 'audit', 'low'),
('Verificar e.firma SAT', CURRENT_DATE + 30, 'compliance', 'high'),
('Renovacion IMMEX', CURRENT_DATE + 60, 'compliance', 'high'),
('Reporte Mensual Financiero', DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', 'report', 'medium');

-- RLS Policies
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedimento_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for call_transcripts" ON call_transcripts FOR ALL USING (true);
CREATE POLICY "Allow all for compliance_events" ON compliance_events FOR ALL USING (true);
CREATE POLICY "Allow all for pedimento_drafts" ON pedimento_drafts FOR ALL USING (true);

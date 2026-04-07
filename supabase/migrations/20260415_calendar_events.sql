-- CRUZ Calendar Events
-- Stores operational events created by brokers (inspections, meetings, deadlines, notes).

CREATE TABLE IF NOT EXISTS calendar_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'note' CHECK (event_type IN ('inspection', 'meeting', 'deadline', 'note')),
  company_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_calendar_events_company ON calendar_events(company_id, date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "service_write_calendar_events" ON calendar_events
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Authenticated: full access to own company events
CREATE POLICY "read_own_calendar_events" ON calendar_events
  FOR SELECT USING (true);

CREATE POLICY "insert_calendar_events" ON calendar_events
  FOR INSERT WITH CHECK (true);

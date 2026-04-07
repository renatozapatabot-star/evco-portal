-- Positive notifications: index for celebration queries + daily cap tracking
-- Part of "good news" notification system

-- Partial index for fast celebration notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_celebration
  ON notifications (company_id, severity, created_at DESC)
  WHERE severity = 'celebration';

-- Daily cap tracking to prevent notification fatigue
CREATE TABLE IF NOT EXISTS good_news_caps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  event_type text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, event_type, event_date)
);

ALTER TABLE good_news_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "good_news_caps_service_only" ON good_news_caps
  FOR ALL USING (auth.role() = 'service_role');

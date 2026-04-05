-- Graduated autonomy configuration per action type
CREATE TABLE IF NOT EXISTS autonomy_config (
  action_type TEXT PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 0,
  accuracy_30d NUMERIC DEFAULT 0,
  consecutive_correct INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  errors_7d INTEGER DEFAULT 0,
  last_promotion TIMESTAMPTZ,
  last_demotion TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults
INSERT INTO autonomy_config (action_type, current_level) VALUES
  ('document_solicitation', 1),
  ('classification', 0),
  ('status_update', 0),
  ('email_response', 0),
  ('pedimento_filing', 0)
ON CONFLICT (action_type) DO NOTHING;

ALTER TABLE autonomy_config ENABLE ROW LEVEL SECURITY;

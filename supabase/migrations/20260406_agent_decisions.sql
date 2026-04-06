-- CRUZ Trade Agent — decision tracking table
-- Every autonomous decision logged with confidence + outcome for learning.

CREATE TABLE IF NOT EXISTS agent_decisions (
  id BIGSERIAL PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_id TEXT,
  company_id TEXT,
  decision TEXT NOT NULL,
  confidence NUMERIC,
  autonomy_level INTEGER DEFAULT 0,
  action_taken TEXT,
  outcome TEXT,
  was_correct BOOLEAN,
  corrected_by TEXT,
  processing_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_agent_decisions" ON agent_decisions
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_agent_cycle ON agent_decisions (cycle_id);
CREATE INDEX idx_agent_trigger ON agent_decisions (trigger_type, created_at DESC);
CREATE INDEX idx_agent_company ON agent_decisions (company_id, created_at DESC);
CREATE INDEX idx_agent_accuracy ON agent_decisions (trigger_type, was_correct) WHERE was_correct IS NOT NULL;

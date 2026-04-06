-- CRUZ Operational Brain — decision intelligence + institutional memory
-- 3 tables: operational_decisions, assumption_audit, learned_patterns

CREATE TABLE IF NOT EXISTS operational_decisions (
  id BIGSERIAL PRIMARY KEY,
  trafico TEXT,
  company_id TEXT,
  decision_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  alternatives_considered JSONB,
  data_points_used JSONB,
  outcome TEXT,
  outcome_score NUMERIC,
  was_optimal BOOLEAN,
  lesson_learned TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assumption_audit (
  id BIGSERIAL PRIMARY KEY,
  assumption TEXT NOT NULL,
  category TEXT,
  evidence_for JSONB,
  evidence_against JSONB,
  still_valid BOOLEAN,
  recommendation TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learned_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  confidence NUMERIC,
  source TEXT,
  sample_size INTEGER,
  first_detected TIMESTAMPTZ DEFAULT now(),
  last_confirmed TIMESTAMPTZ DEFAULT now(),
  superseded_by BIGINT REFERENCES learned_patterns(id),
  active BOOLEAN DEFAULT true
);

CREATE INDEX idx_decisions_company ON operational_decisions(company_id);
CREATE INDEX idx_decisions_type ON operational_decisions(decision_type);
CREATE INDEX idx_patterns_active ON learned_patterns(active, pattern_type);
ALTER TABLE operational_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assumption_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_op_decisions" ON operational_decisions
  FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "service_role_assumptions" ON assumption_audit
  FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "service_role_patterns" ON learned_patterns
  FOR ALL USING (current_setting('role', true) = 'service_role');

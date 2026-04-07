-- Build 232: Exception Intelligence — structured diagnoses with outcome tracking
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS exception_diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  trafico TEXT,

  -- Exception context
  exception_type TEXT NOT NULL,         -- delayed_crossing, overdue_document, stuck_trafico, value_anomaly, reconocimiento
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Hypothesis
  hypotheses JSONB NOT NULL,            -- [{rank, hypothesis, confidence, evidence}]
  primary_hypothesis TEXT NOT NULL,
  primary_confidence NUMERIC(3,2) NOT NULL CHECK (primary_confidence BETWEEN 0 AND 1),

  -- Recommended action
  recommended_action TEXT,
  recommended_action_type TEXT          -- 'wait', 'escalate', 'investigate', 'contact_supplier', 'contact_client'
    CHECK (recommended_action_type IN ('wait', 'escalate', 'investigate', 'contact_supplier', 'contact_client')),
  estimated_resolution_hours INTEGER,

  -- Communication drafts
  client_message_draft TEXT,            -- Spanish message for client (pending approval)
  internal_message_draft TEXT,          -- Spanish message for operations team

  -- Context data (for portal display)
  context JSONB,                        -- {supplier, fraccion, value, status, related_traficos[], etc.}

  -- Outcome tracking
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'monitoring', 'resolved', 'false_alarm')),
  resolved_at TIMESTAMPTZ,
  actual_cause TEXT,                    -- What actually happened (filled when resolved)
  hypothesis_correct BOOLEAN,           -- Was primary hypothesis right?

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE exception_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_exception_diagnoses" ON exception_diagnoses
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_exception_diagnoses" ON exception_diagnoses
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_exc_diag_company ON exception_diagnoses(company_id, status, detected_at DESC);
CREATE INDEX idx_exc_diag_trafico ON exception_diagnoses(trafico) WHERE trafico IS NOT NULL;
CREATE INDEX idx_exc_diag_open ON exception_diagnoses(status, severity) WHERE status = 'open';

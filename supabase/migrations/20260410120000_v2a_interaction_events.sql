-- ═══════════════════════════════════════════════════════════════
-- V2-A: Interaction Events — Client-side telemetry for data moat
-- Created: Block V2-A, April 10 2026
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS interaction_events (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  event_name  TEXT,
  page_path   TEXT NOT NULL,
  company_id  TEXT,
  operator_id TEXT,
  session_id  TEXT,
  payload     JSONB DEFAULT '{}'::jsonb,
  user_agent  TEXT,
  viewport    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ie_type_created
  ON interaction_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ie_company_created
  ON interaction_events (company_id, created_at DESC)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ie_session
  ON interaction_events (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ie_page
  ON interaction_events (page_path, created_at DESC);

-- RLS: service-role only (telemetry written by API with service key)
ALTER TABLE interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interaction_events_service_only" ON interaction_events
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE interaction_events IS 'V2-A: Client-side interaction telemetry for ML training and data moat. Service-role write only.';

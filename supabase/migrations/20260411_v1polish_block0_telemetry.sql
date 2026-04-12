-- ═══════════════════════════════════════════════════════════════
-- V1 Polish Pack · Block 0 — Usage telemetry foundation
-- Reuses interaction_events (created in 20260410120000). Adds the
-- columns needed for the Polish Pack event taxonomy and exposes a
-- `usage_events` view so Polish-Pack code can use the spec names.
-- RLS: writes go through /api/telemetry using the service role.
-- ═══════════════════════════════════════════════════════════════

-- Columns added by Polish Pack. payload already exists → use it as metadata.
ALTER TABLE interaction_events
  ADD COLUMN IF NOT EXISTS user_id     TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   TEXT;

CREATE INDEX IF NOT EXISTS idx_ie_user_created
  ON interaction_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ie_entity
  ON interaction_events (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

-- Polish-Pack canonical view. Matches the names used throughout the
-- spec (route, metadata) without forcing us to duplicate the table.
CREATE OR REPLACE VIEW usage_events AS
SELECT
  id,
  event_type,
  user_id,
  company_id,
  operator_id,
  session_id,
  page_path AS route,
  entity_type,
  entity_id,
  payload    AS metadata,
  user_agent,
  viewport,
  created_at
FROM interaction_events;

COMMENT ON VIEW usage_events IS
  'V1 Polish Pack · Block 0 — spec-shaped alias over interaction_events.';

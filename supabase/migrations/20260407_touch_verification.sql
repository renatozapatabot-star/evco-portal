-- ============================================================================
-- CRUZ Touch Verification Framework
-- Enforces <= 5 human touches per pilot shipment
-- Patente 3596 · Aduana 240 · Nuevo Laredo
-- ============================================================================

-- ── Layer 1: touch_count + touch_log fields on traficos ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traficos' AND column_name = 'touch_count'
  ) THEN
    ALTER TABLE traficos ADD COLUMN touch_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traficos' AND column_name = 'touch_log'
  ) THEN
    ALTER TABLE traficos ADD COLUMN touch_log JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traficos' AND column_name = 'is_pilot'
  ) THEN
    ALTER TABLE traficos ADD COLUMN is_pilot BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ── Layer 1: Trigger to log touches and alert on budget exceeded ──

CREATE OR REPLACE FUNCTION log_touch_increment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when touch_count increases
  IF NEW.touch_count > OLD.touch_count THEN
    -- Append to touch_log
    NEW.touch_log = COALESCE(OLD.touch_log, '[]'::jsonb) || jsonb_build_object(
      'touch_number', NEW.touch_count,
      'timestamp', now()::text,
      'previous_count', OLD.touch_count
    );

    -- Alert if budget exceeded (> 5 for pilot shipments)
    IF NEW.is_pilot = true AND NEW.touch_count > 5 THEN
      PERFORM pg_notify('touch_budget_exceeded',
        json_build_object(
          'trafico', NEW.trafico,
          'touch_count', NEW.touch_count,
          'company_id', NEW.company_id
        )::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_log ON traficos;
CREATE TRIGGER trg_touch_log
  BEFORE UPDATE OF touch_count ON traficos
  FOR EACH ROW
  EXECUTE FUNCTION log_touch_increment();

-- ── Layer 4: Shadow-touch detection snapshots table ──

CREATE TABLE IF NOT EXISTS trafico_snapshots (
  id BIGSERIAL PRIMARY KEY,
  trafico_id TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trafico_snapshots_lookup
  ON trafico_snapshots (trafico_id, captured_at DESC);

-- RLS: service role only
ALTER TABLE trafico_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trafico_snapshots_service_only" ON trafico_snapshots;
CREATE POLICY "trafico_snapshots_service_only" ON trafico_snapshots
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- ── Cleanup: auto-delete snapshots older than 30 days ──
-- (Run via cron: DELETE FROM trafico_snapshots WHERE captured_at < now() - interval '30 days')

-- ============================================================================
-- End of migration
-- ============================================================================

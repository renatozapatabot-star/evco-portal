-- ═══════════════════════════════════════════════════════════════
-- AGUILA V1.5 · F18 — Bridge wait times (CBP/SOIA snapshot store)
--
-- Stores per-bridge/direction/lane wait-time snapshots. Public data:
-- RLS enabled with a permissive authenticated-read policy; writes
-- restricted to the service role. Ticker (F5) and corridor (F4)
-- read `getLatestBridgeWaits()`.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bridge_wait_times (
  id            bigserial PRIMARY KEY,
  bridge_code   text        NOT NULL,
  bridge_name   text,
  direction     text        NOT NULL CHECK (direction IN ('northbound','southbound')),
  lane_type     text        NOT NULL CHECK (lane_type IN ('commercial','passenger','fast','ready')),
  wait_minutes  int,
  source        text        NOT NULL DEFAULT 'soia',
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb
);

CREATE INDEX IF NOT EXISTS idx_bridge_wait_times_bridge_dir_fetched
  ON bridge_wait_times(bridge_code, direction, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_wait_times_fetched_at
  ON bridge_wait_times(fetched_at DESC);

ALTER TABLE bridge_wait_times ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bridge_wait_times' AND policyname = 'bridge_wait_times_authenticated_read'
  ) THEN
    CREATE POLICY bridge_wait_times_authenticated_read ON bridge_wait_times
      FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON TABLE bridge_wait_times IS
  'AGUILA V1.5 F18 · CBP/SOIA bridge wait time snapshots — stale-triggered refresh.';

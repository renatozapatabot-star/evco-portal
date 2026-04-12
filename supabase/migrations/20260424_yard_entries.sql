-- Block 14 · Yard / patio entry registration.
-- Operators park trailers on the yard (A1..Z9 grid) while waiting for the
-- next step (pedimento, bodega, pickup). Visual grid + waiting-time color
-- coding is the mobile surface; this table is the immutable backing store.
-- Events `yard_entered` + `yard_exited` wired to workflow_events. Idempotent.

CREATE TABLE IF NOT EXISTS yard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id text NOT NULL,
  company_id text NOT NULL,
  trailer_number text NOT NULL,
  yard_position text NOT NULL,
  refrigerated boolean NOT NULL DEFAULT false,
  temperature_setting numeric(4,1),
  entered_at timestamptz DEFAULT now(),
  exited_at timestamptz,
  created_by text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_yard_active
  ON yard_entries(exited_at, company_id) WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_yard_trafico
  ON yard_entries(trafico_id);

-- === RLS ===
ALTER TABLE yard_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'yard_entries_read_own_company') THEN
    CREATE POLICY yard_entries_read_own_company ON yard_entries
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'yard_entries_service_role_all') THEN
    CREATE POLICY yard_entries_service_role_all ON yard_entries
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- === events_catalog seed ===
-- Only yard_entered + yard_exited. No extra events.
INSERT INTO events_catalog (event_type, category, visibility, display_name_es, description_es, icon_name, color_token)
VALUES
  ('yard_entered', 'lifecycle', 'private', 'Entrada a patio', 'Caja estacionada en patio', 'parking-square', 'ACCENT_CYAN'),
  ('yard_exited',  'lifecycle', 'private', 'Salida de patio', 'Caja salió del patio',      'log-out',        'ACCENT_CYAN')
ON CONFLICT (event_type) DO NOTHING;

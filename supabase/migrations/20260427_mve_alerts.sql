-- Block 17 · MVE Monitor with Auto-Detection
-- Tracks approaching MVE deadlines for pedimentos that have not crossed.
-- Populated by `/api/mve/scan` (Vercel cron every 30 min). Critical alerts
-- fire a Telegram notification via `src/lib/telegram.ts`.
-- Idempotent: safe to re-run.
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS mve_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL,
  trafico_id text NOT NULL,
  company_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  deadline_at timestamptz NOT NULL,
  days_remaining integer NOT NULL,
  message text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pedimento_id, deadline_at)
);

CREATE INDEX IF NOT EXISTS idx_mve_active
  ON mve_alerts(resolved, severity, deadline_at);
CREATE INDEX IF NOT EXISTS idx_mve_company
  ON mve_alerts(company_id, resolved);

ALTER TABLE mve_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mve_alerts_read_own_company') THEN
    CREATE POLICY mve_alerts_read_own_company ON mve_alerts
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mve_alerts_service_role_all') THEN
    CREATE POLICY mve_alerts_service_role_all ON mve_alerts
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

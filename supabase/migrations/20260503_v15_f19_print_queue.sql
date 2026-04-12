-- V1.5 F19 · Print queue — thermal label jobs for Vicente's bodega.
-- Each row is one print job (entrada label, future: pedimento cover, etc.).
-- Service role writes via /api/labels/print; warehouse + admin read their
-- own tenant scope. Idempotent. Patente 3596 · Aduana 240.

CREATE TABLE IF NOT EXISTS print_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'printed', 'failed', 'cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz,
  printer_id text,
  error text
);

CREATE INDEX IF NOT EXISTS idx_print_queue_status_created
  ON print_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_queue_company
  ON print_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_print_queue_created_by
  ON print_queue(created_by);

ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'print_queue_read_own_company'
  ) THEN
    CREATE POLICY print_queue_read_own_company ON print_queue
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'print_queue_insert_own_company'
  ) THEN
    CREATE POLICY print_queue_insert_own_company ON print_queue
      FOR INSERT TO authenticated
      WITH CHECK (company_id = current_setting('app.company_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'print_queue_service_role_all'
  ) THEN
    CREATE POLICY print_queue_service_role_all ON print_queue
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE print_queue IS
  'AGUILA V1.5 F19 · Print label queue — entrada 4x6 thermal labels, future pedimento covers.';

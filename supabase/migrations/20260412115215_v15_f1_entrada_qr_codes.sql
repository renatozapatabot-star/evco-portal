-- V1.5 F1 · Entrada QR codes — company_id scoping + RLS + indexes.
-- Short-code generation for warehouse trailer labels. Vicente scans the label
-- on arrival; /api/qr/resolve fires `warehouse_entry_received` onto
-- workflow_events (Block 7 corridor-position routes it to rz_warehouse).
-- Idempotent. Patente 3596 · Aduana 240.

CREATE TABLE IF NOT EXISTS entrada_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  trafico_id text NOT NULL,
  company_id text NOT NULL,
  entrada_id uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by text,
  scanned_at timestamptz,
  scanned_by text,
  scan_location text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_entrada_qr_codes_trafico
  ON entrada_qr_codes(trafico_id);
CREATE INDEX IF NOT EXISTS idx_entrada_qr_codes_company
  ON entrada_qr_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_entrada_qr_codes_code
  ON entrada_qr_codes(code);

ALTER TABLE entrada_qr_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entrada_qr_codes_read_own_company') THEN
    CREATE POLICY entrada_qr_codes_read_own_company ON entrada_qr_codes
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entrada_qr_codes_service_role_all') THEN
    CREATE POLICY entrada_qr_codes_service_role_all ON entrada_qr_codes
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- AGUILA · Patentes + E_FIRMA / FIEL tracking.
--
-- One row per patent assigned to Renato Zapata & Company.
-- Protects Patente 3596 (primary) and 3902 (secondary) — if an
-- E_FIRMA or FIEL lapses, every pedimento we'd file that day breaks.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS patentes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              text NOT NULL UNIQUE,
  nombre              text NOT NULL,
  efirma_expiry       date,
  fiel_expiry         date,
  patent_renewal_date date,
  authorized_offices  text[] NOT NULL DEFAULT '{}'::text[],
  certificate_file_url text,
  notes               text,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patentes_efirma_expiry
  ON patentes(efirma_expiry)
  WHERE efirma_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patentes_fiel_expiry
  ON patentes(fiel_expiry)
  WHERE fiel_expiry IS NOT NULL;

-- RLS — admin/broker only. Operators see the cockpit alert summary
-- via their own role, but full patente records live admin-side.
ALTER TABLE patentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patentes_admin_read ON patentes;
CREATE POLICY patentes_admin_read ON patentes
  FOR SELECT USING (
    current_setting('app.role', true) IN ('admin','broker')
  );

DROP POLICY IF EXISTS patentes_service_all ON patentes;
CREATE POLICY patentes_service_all ON patentes
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS patentes_no_delete ON patentes;
CREATE POLICY patentes_no_delete ON patentes
  FOR DELETE USING (false);

-- Seed the canonical two patentes. Idempotent via ON CONFLICT.
INSERT INTO patentes (numero, nombre, authorized_offices, notes)
VALUES
  ('3596', 'Renato Zapata & Company · Patente 3596', '{"Aduana 240 Nuevo Laredo"}', 'Primary patent — 1941'),
  ('3902', 'Renato Zapata & Company · Patente 3902', '{"Aduana 240 Nuevo Laredo"}', 'Secondary patent')
ON CONFLICT (numero) DO NOTHING;

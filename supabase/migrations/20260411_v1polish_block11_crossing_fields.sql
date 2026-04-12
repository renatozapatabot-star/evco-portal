-- V1 Polish Pack · Block 11 — Crossing schedule fields
-- Adds timeline + bridge + lane + semáforo to traficos so /cruce can render a
-- bridge-grouped schedule. Backfill is Renato's responsibility (out of scope).

ALTER TABLE traficos
  ADD COLUMN IF NOT EXISTS fecha_cruce_planeada timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_cruce_estimada timestamptz,
  ADD COLUMN IF NOT EXISTS bridge text,
  ADD COLUMN IF NOT EXISTS lane text,
  ADD COLUMN IF NOT EXISTS semaforo text;

-- Index to make range queries on /cruce fast (most common: scheduled next 7d)
CREATE INDEX IF NOT EXISTS idx_traficos_cruce_planeada
  ON traficos (fecha_cruce_planeada)
  WHERE fecha_cruce_planeada IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_traficos_cruce_estimada
  ON traficos (fecha_cruce_estimada)
  WHERE fecha_cruce_estimada IS NOT NULL;

-- Bridge grouping: operators filter by bridge in the multi-select.
CREATE INDEX IF NOT EXISTS idx_traficos_bridge
  ON traficos (bridge)
  WHERE bridge IS NOT NULL;

-- RLS already enabled on traficos — new columns inherit existing policies.

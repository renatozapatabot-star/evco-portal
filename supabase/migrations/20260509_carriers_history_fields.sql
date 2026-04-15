-- ═══════════════════════════════════════════════════════════════
-- AGUILA · Carriers — Phase 6 extra fields.
--
-- Adds calificacion (1-5), mc_number (US motor carrier identifier),
-- tipos_trailer (flatbed, dry van, reefer, etc.), and area_servicio
-- for transfer/drayage carriers. RLS already enabled on `carriers`
-- in 20260422 — these new columns inherit those policies.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS calificacion    smallint
    CHECK (calificacion IS NULL OR (calificacion BETWEEN 1 AND 5));

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS mc_number       text;

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS tipos_trailer   text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS area_servicio   text;

-- Index so the cockpit can filter "active + rated >= 4" without a seq scan.
CREATE INDEX IF NOT EXISTS idx_carriers_active_rating
  ON carriers (active, calificacion DESC)
  WHERE active = true;

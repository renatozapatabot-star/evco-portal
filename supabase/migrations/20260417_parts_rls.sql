-- ═══════════════════════════════════════════════════════════════
-- Parts intelligence · RLS enforcement + indexes
-- Apply: Sunday 2026-04-17 via Supabase SQL editor (db push banned)
--
-- Closes the anon-key read leak on four client-scoped tables feeding
-- the parte intelligence surface. Portal uses its own HMAC session
-- (not Supabase auth) so we never set request.jwt.claims — the simplest
-- safe policy is `USING (false)`: service-role bypasses RLS (so every
-- server component using createServerClient still works), while the
-- anon key is fully blocked.
--
-- One known casualty: src/app/pedimentos/nuevo/page.tsx is a `'use
-- client'` operator page using the anon key to read globalpc_partidas
-- + globalpc_proveedores directly. Its dropdowns will return empty
-- until the queries are migrated to /api/data (service-role). That's
-- an operator-only page, not part of Ursula's client surface. Tracked
-- as a follow-up — see /tmp/parts-data-reality.md.
-- ═══════════════════════════════════════════════════════════════

-- ── globalpc_productos (748K rows, 148K EVCO) ──
ALTER TABLE globalpc_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS productos_service_only ON globalpc_productos;
CREATE POLICY productos_service_only ON globalpc_productos
  FOR ALL
  USING (false);

-- ── globalpc_partidas (290K rows, all EVCO currently) ──
ALTER TABLE globalpc_partidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partidas_service_only ON globalpc_partidas;
CREATE POLICY partidas_service_only ON globalpc_partidas
  FOR ALL
  USING (false);

-- ── classification_log (empty today but will fill as SuperTito reviews) ──
ALTER TABLE classification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classification_log_service_only ON classification_log;
CREATE POLICY classification_log_service_only ON classification_log
  FOR ALL
  USING (false);

-- ── oca_database (6.6K rows, 6.3K EVCO) ──
ALTER TABLE oca_database ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oca_database_service_only ON oca_database;
CREATE POLICY oca_database_service_only ON oca_database
  FOR ALL
  USING (false);

-- ── Performance indexes for the parte intelligence API ──
-- All tenant-aware. `IF NOT EXISTS` so the migration is idempotent.

CREATE INDEX IF NOT EXISTS idx_productos_company_created
  ON globalpc_productos(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_productos_company_cve
  ON globalpc_productos(company_id, cve_producto);

CREATE INDEX IF NOT EXISTS idx_productos_company_fraccion
  ON globalpc_productos(company_id, fraccion);

-- Partidas: the hot join — cve_producto + company_id + created_at
CREATE INDEX IF NOT EXISTS idx_partidas_company_cve_created
  ON globalpc_partidas(company_id, cve_producto, created_at DESC);

-- Classification log: uses client_id (legacy name) + numero_parte for lookups
CREATE INDEX IF NOT EXISTS idx_classification_log_client_parte
  ON classification_log(client_id, numero_parte);

CREATE INDEX IF NOT EXISTS idx_classification_log_client_ts
  ON classification_log(client_id, ts DESC);

-- OCA lookup by tenant + fraccion is the common access pattern
CREATE INDEX IF NOT EXISTS idx_oca_company_fraccion
  ON oca_database(company_id, fraccion);

COMMENT ON TABLE globalpc_productos IS 'Service-role-only access; client queries must route through /api/ (createServerClient bypasses RLS).';

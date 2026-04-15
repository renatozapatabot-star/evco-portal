-- ═══════════════════════════════════════════════════════════════
-- AGUILA V1 · performance indexes (April 2026)
--
-- Performance audit flagged three queries hitting large tables without
-- supporting indexes:
--   · ILIKE on traficos.proveedores   → full-text search (GIN)
--   · client_code + mve_deadline      → compound b-tree, partial index
--   · updated_at DESC sort            → b-tree descending
--
-- CREATE INDEX CONCURRENTLY would be ideal but Supabase migrations run
-- inside a transaction that forbids CONCURRENTLY. If any of these indexes
-- take too long against production load, drop the migration, run the
-- CONCURRENTLY variant manually in the SQL editor, then `migration repair`.
-- ═══════════════════════════════════════════════════════════════

-- Spanish full-text search on proveedores (used by intelligence ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_traficos_proveedores_fts
  ON traficos USING GIN(to_tsvector('spanish', COALESCE(proveedores, '')));

-- Compound partial index for compliance countdown queries
-- (used by MVE dashboard, traficos/[id] deadlines)
CREATE INDEX IF NOT EXISTS idx_traficos_client_mve_deadline
  ON traficos (company_id, mve_deadline)
  WHERE mve_deadline IS NOT NULL;

-- Descending sort on updated_at — used by live monitor feeds
CREATE INDEX IF NOT EXISTS idx_traficos_updated_at_desc
  ON traficos (updated_at DESC);

-- Bonus: expediente_documentos.trafico_id is read on every detail page
-- but FK creation in other migrations may have skipped an explicit index.
CREATE INDEX IF NOT EXISTS idx_expediente_documentos_trafico_id
  ON expediente_documentos (trafico_id)
  WHERE trafico_id IS NOT NULL;

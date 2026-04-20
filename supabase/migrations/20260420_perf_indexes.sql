-- Performance indexes · Tier 3.1 post-Sunday stress pass
--
-- Gaps identified by scanning existing migrations vs the query patterns
-- used on /inicio, /catalogo, and sync scripts. Existing indexes verified
-- before writing this migration — no duplicates.
--
-- Impact estimates (CLAUDE.md performance budgets):
-- · /inicio KPI tiles: expediente_documentos scan drops from full-table
--   to compound-index lookup. Currently soft-wrapped with .limit(2000);
--   this lets that query stay sub-100ms as the table grows past 307K.
-- · /catalogo partes query: .in('cve_producto', activeList) on
--   globalpc_productos previously had only single-col (company_id)
--   index. The compound (company_id, cve_producto) turns an index-scan
--   + filter into an index-only lookup.
-- · globalpc_partidas had ZERO indexes (22K rows). Every join through
--   partidas was a sequential scan. Adding two minimum-viable indexes
--   (company_id, cve_producto) and the single-col cve_producto for
--   back-filtering catalog surfaces.
--
-- All CREATE INDEX IF NOT EXISTS — safe to re-run. Executed inside
-- Supabase's default transactional migration; brief table locks during
-- index build are acceptable on these table sizes (148K productos,
-- 22K partidas, 307K expediente_documentos). Re-evaluate CONCURRENTLY
-- when any table crosses 5M rows.

-- ── /inicio KPI tiles ──

CREATE INDEX IF NOT EXISTS idx_expediente_documentos_company_uploaded
  ON expediente_documentos (company_id, uploaded_at DESC);

-- ── Catalog surfaces ──

CREATE INDEX IF NOT EXISTS idx_globalpc_productos_company_cve
  ON globalpc_productos (company_id, cve_producto);

CREATE INDEX IF NOT EXISTS idx_globalpc_partidas_company_cve
  ON globalpc_partidas (company_id, cve_producto);

-- ── Back-filtering + joins ──
-- globalpc_partidas.cve_producto is the join key to globalpc_productos
-- for all catalog queries. Without this, every join scans all partidas.
CREATE INDEX IF NOT EXISTS idx_globalpc_partidas_cve_producto
  ON globalpc_partidas (cve_producto);

-- Verify with: EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM globalpc_productos
--   WHERE company_id = 'evco' AND cve_producto = ANY(ARRAY['X1','X2']);
-- Should show "Index Scan using idx_globalpc_productos_company_cve"
-- instead of "Seq Scan" + "Filter".

-- Supplementary perf indexes · Tier 3.1 continuation
--
-- Follow-up to 20260420_perf_indexes.sql after auditing the actual
-- /inicio query shape in src/app/inicio/page.tsx. The /inicio cockpit
-- runs ~12 softCount queries + 7 softData time-bucket queries per
-- render — the 3 indexes below cover the remaining unindexed hot
-- paths that powers those queries.
--
-- Why this migration is separate from 20260420_perf_indexes.sql:
-- the first pass focused on tables surfaced by the stress-audit
-- agents (expediente_documentos, globalpc_productos, globalpc_partidas).
-- This pass came from reading inicio/page.tsx line by line.
--
-- Impact (estimated from query patterns):
-- · entradas.semana        — 65K-row seq-scan → index-only count
-- · traficos.activos       — `is fecha_cruce null + gte fecha_llegada`
--                            becomes partial-index lookup
-- · traficos.cruzados_mes  — monthly fecha_cruce filter indexed
-- · catalogo.mes           — fraccion_classified_at gte filter indexed
--
-- All CREATE INDEX IF NOT EXISTS — idempotent.

-- ── entradas (65K rows, previously ZERO indexes) ──

CREATE INDEX IF NOT EXISTS idx_entradas_company_fecha_llegada
  ON entradas (company_id, fecha_llegada_mercancia DESC);

-- ── traficos — fecha_cruce filtering ──
-- `idx_traficos_company_estatus` covers (company_id, estatus, fecha_llegada)
-- but /inicio also filters on fecha_cruce heavily:
--   · .is('fecha_cruce', null) — "not yet crossed"
--   · .gte('fecha_cruce', monthStartIso) — "crossed this month"
-- A compound (company_id, fecha_cruce) handles both directions.

CREATE INDEX IF NOT EXISTS idx_traficos_company_fecha_cruce
  ON traficos (company_id, fecha_cruce);

-- ── globalpc_productos — classification date filter ──
-- /inicio catalog.mes counts productos classified this month:
--   .eq(company_id) + .in(cve_producto) + .gte(fraccion_classified_at)
-- The compound (company_id, cve_producto) from the prior migration
-- handles the join; fraccion_classified_at needs its own index so
-- the gte predicate isn't a seq-scan-on-filter.

CREATE INDEX IF NOT EXISTS idx_globalpc_productos_classified_at
  ON globalpc_productos (company_id, fraccion_classified_at)
  WHERE fraccion_classified_at IS NOT NULL;

-- Verify post-apply with:
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT count(*) FROM entradas
--     WHERE company_id = 'evco'
--       AND fecha_llegada_mercancia >= now() - interval '7 days';
-- Expect: "Index Scan using idx_entradas_company_fecha_llegada"

-- =====================================================================
-- V2-B: Proposed Automations — Karpathy Loop Trainer output
-- Created: Block V2-B, April 10 2026
-- Purpose: Store automation patterns mined from operator/agent/product
--          data. Human approval required before rules become active.
-- =====================================================================

CREATE TABLE IF NOT EXISTS proposed_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type    TEXT NOT NULL,
  pattern_key     TEXT NOT NULL,
  company_id      TEXT,
  proposal        JSONB NOT NULL DEFAULT '{}',
  confidence      NUMERIC(4,3) NOT NULL,
  evidence_count  INTEGER NOT NULL DEFAULT 0,
  evidence_sample JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending',
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_status
  ON proposed_automations(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pa_pattern
  ON proposed_automations(pattern_type, pattern_key);

CREATE INDEX IF NOT EXISTS idx_pa_company
  ON proposed_automations(company_id) WHERE company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_unique_pending
  ON proposed_automations(pattern_type, pattern_key) WHERE status = 'pending';

ALTER TABLE proposed_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposed_automations_service_only" ON proposed_automations
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE proposed_automations
  IS 'V2-B: Karpathy Loop Trainer proposals. Patterns mined nightly from operator/agent/product data. Human approval required.';

-- =====================================================================
-- Supporting index for P1 classification pattern queries on 748K rows
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_gp_classification_pattern
  ON globalpc_productos(cve_proveedor, descripcion, fraccion)
  WHERE fraccion IS NOT NULL AND cve_proveedor IS NOT NULL;

-- =====================================================================
-- RPC: find_classification_patterns
-- Efficient GROUP BY on globalpc_productos for the trainer script.
-- Returns supplier+product combos consistently classified to one fraccion.
-- =====================================================================

CREATE OR REPLACE FUNCTION find_classification_patterns(
  p_min_count INTEGER DEFAULT 3,
  p_min_consistency NUMERIC DEFAULT 0.85,
  p_max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  cve_proveedor TEXT,
  descripcion TEXT,
  fraccion TEXT,
  total_count BIGINT,
  fraccion_count BIGINT,
  consistency NUMERIC,
  sample_ids BIGINT[]
) LANGUAGE sql STABLE AS $$
  WITH per_fraccion AS (
    SELECT
      gp.cve_proveedor,
      gp.descripcion,
      gp.fraccion,
      COUNT(*) AS fraccion_count,
      ARRAY_AGG(gp.id ORDER BY gp.id DESC) FILTER (WHERE gp.id IS NOT NULL) AS all_ids
    FROM globalpc_productos gp
    WHERE gp.fraccion IS NOT NULL
      AND gp.cve_proveedor IS NOT NULL
      AND gp.descripcion IS NOT NULL
    GROUP BY gp.cve_proveedor, gp.descripcion, gp.fraccion
  ),
  per_group AS (
    SELECT
      pf.*,
      SUM(pf.fraccion_count) OVER (PARTITION BY pf.cve_proveedor, pf.descripcion) AS total_count,
      ROW_NUMBER() OVER (
        PARTITION BY pf.cve_proveedor, pf.descripcion
        ORDER BY pf.fraccion_count DESC
      ) AS rn
    FROM per_fraccion pf
  )
  SELECT
    pg.cve_proveedor,
    pg.descripcion,
    pg.fraccion,
    pg.total_count,
    pg.fraccion_count,
    (pg.fraccion_count::numeric / pg.total_count) AS consistency,
    pg.all_ids[1:5] AS sample_ids
  FROM per_group pg
  WHERE pg.rn = 1
    AND pg.total_count >= p_min_count
    AND (pg.fraccion_count::numeric / pg.total_count) >= p_min_consistency
  ORDER BY pg.total_count DESC
  LIMIT p_max_results;
$$;

COMMENT ON FUNCTION find_classification_patterns IS 'V2-B: Find supplier+product combos consistently classified to one fraccion in globalpc_productos.';

-- ============================================================================
-- CRUZ Intelligence Sandbox
-- View: trafico_intelligence — all 32,299 tráficos (2011-2026) with computed fields
-- Table: cruz_sandbox — model training session results
-- ============================================================================

-- 1. Intelligence view — enriches traficos with completeness + temporal features
CREATE OR REPLACE VIEW trafico_intelligence AS
SELECT
  t.*,
  tc.score AS completeness_score,
  tc.blocking_count,
  tc.can_file,
  EXTRACT(YEAR FROM t.fecha_llegada) AS year,
  EXTRACT(MONTH FROM t.fecha_llegada) AS month,
  EXTRACT(DOW FROM t.fecha_llegada) AS day_of_week,
  EXTRACT(EPOCH FROM (
    t.fecha_cruce - t.fecha_llegada
  )) / 3600 AS hours_to_cross,
  CASE
    WHEN t.fecha_llegada >= '2024-01-01' THEN 'active'
    ELSE 'historical'
  END AS data_tier
FROM traficos t
LEFT JOIN trafico_completeness tc
  ON tc.trafico_id = t.trafico;

-- 2. Sandbox training results table
CREATE TABLE IF NOT EXISTS cruz_sandbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  model_type TEXT NOT NULL,
  -- model_type values: 'crossing_time' | 'doc_prediction' | 'fraccion_match' | 'anomaly_detection'
  training_samples INTEGER,
  validation_samples INTEGER,
  accuracy_score FLOAT,
  baseline_accuracy FLOAT,
  improvement_delta FLOAT,
  top_features JSONB,
  confusion_matrix JSONB,
  sample_predictions JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS — service role only (internal intelligence, never client-facing)
ALTER TABLE cruz_sandbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_all" ON cruz_sandbox
  FOR ALL USING (auth.role() = 'service_role');

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_cruz_sandbox_model_type
  ON cruz_sandbox (model_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cruz_sandbox_created
  ON cruz_sandbox (created_at DESC);

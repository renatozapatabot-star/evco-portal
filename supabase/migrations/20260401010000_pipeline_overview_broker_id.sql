-- Add broker_id to pipeline_overview view for multi-broker data isolation
DROP VIEW IF EXISTS pipeline_overview;

CREATE OR REPLACE VIEW pipeline_overview AS
SELECT
  tc.trafico_id,
  tc.score,
  tc.blocking_count,
  tc.warning_count,
  tc.can_file,
  tc.can_cross,
  tc.blocking_docs,
  tc.docs_required,
  tc.docs_present,
  t.trafico AS trafico_number,
  t.company_id,
  t.tenant_slug,
  t.estatus,
  t.importe_total,
  t.descripcion_mercancia,
  t.fecha_llegada,
  t.semaforo,
  t.broker_id,
  t.updated_at,
  CASE
    WHEN tc.score = 100 THEN 'ready_to_cross'
    WHEN tc.can_file = true THEN 'ready_to_file'
    WHEN tc.score >= 50 THEN 'in_progress'
    ELSE 'needs_docs'
  END AS pipeline_stage
FROM trafico_completeness tc
JOIN traficos t ON t.trafico = tc.trafico_id
ORDER BY
  CASE
    WHEN tc.score = 100 THEN 1
    WHEN tc.can_file = true THEN 2
    WHEN tc.score >= 50 THEN 3
    ELSE 4
  END,
  tc.score DESC;

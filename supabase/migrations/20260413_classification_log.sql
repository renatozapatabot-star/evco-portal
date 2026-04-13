-- ═══════════════════════════════════════════════════════════════
-- AGUILA · self-service classifier audit log
-- Every /api/clasificar/nuevo attempt (success or failure) inserts
-- one row. Append-only. Tenant-scoped reads via RLS; writes via
-- service role from the route handler only.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS classification_log (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             text NOT NULL,
  created_by_role        text NOT NULL,
  description            text NOT NULL,
  image_mime             text,
  model                  text NOT NULL,
  fraccion               text,
  tmec_eligible          boolean,
  nom_required           text[],
  confidence             smallint NOT NULL DEFAULT 0,
  justificacion          text,
  alternatives           jsonb,
  inserted_into_trafico  text,
  input_tokens           int,
  output_tokens          int,
  cost_usd               numeric(10,6),
  latency_ms             int,
  error_code             text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_log_company_created
  ON classification_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_log_fraccion
  ON classification_log(fraccion) WHERE fraccion IS NOT NULL;

ALTER TABLE classification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'classification_log' AND policyname = 'classification_log_tenant_read'
  ) THEN
    CREATE POLICY classification_log_tenant_read ON classification_log
      FOR SELECT USING (
        company_id = current_setting('app.company_id', true)
        OR current_setting('app.company_id', true) IN ('admin', 'internal')
      );
  END IF;
END $$;

COMMENT ON TABLE classification_log IS
  'AGUILA · audit trail for self-service product classifier. Append-only.';

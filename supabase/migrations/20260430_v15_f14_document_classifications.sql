-- ═══════════════════════════════════════════════════════════════
-- AGUILA V1.5 · F14 — Document auto-classification w/ Claude Vision
--
-- Extends the existing `document_classifications` table (created by
-- scripts/doc-classifier.js + email intake pipeline) with the richer
-- extraction fields the vision layer now writes: supplier, invoice
-- number/date/currency/amount, line items, raw response, confirmed
-- state, and links to expediente + invoice bank rows.
--
-- Idempotent: every column is ADD COLUMN IF NOT EXISTS so re-runs
-- on environments that already applied earlier versions are safe.
-- RLS follows the tenant pattern using `app.company_id`.
-- ═══════════════════════════════════════════════════════════════

-- Create table if it does not already exist (fresh environments).
-- The pipeline/doc-classifier migration creates a richer shape, so
-- this CREATE is the minimal skeleton — ALTERs below bring it to
-- the F14 spec on ALL environments.
CREATE TABLE IF NOT EXISTS document_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classified_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_classifications
  ADD COLUMN IF NOT EXISTS company_id              text,
  ADD COLUMN IF NOT EXISTS expediente_document_id  uuid,
  ADD COLUMN IF NOT EXISTS invoice_bank_id         uuid,
  ADD COLUMN IF NOT EXISTS file_url                text,
  ADD COLUMN IF NOT EXISTS doc_type                text,
  ADD COLUMN IF NOT EXISTS supplier                text,
  ADD COLUMN IF NOT EXISTS invoice_number          text,
  ADD COLUMN IF NOT EXISTS invoice_date            date,
  ADD COLUMN IF NOT EXISTS currency                text,
  ADD COLUMN IF NOT EXISTS amount                  numeric,
  ADD COLUMN IF NOT EXISTS line_items              jsonb,
  ADD COLUMN IF NOT EXISTS raw_response            jsonb,
  ADD COLUMN IF NOT EXISTS model                   text,
  ADD COLUMN IF NOT EXISTS confidence              numeric,
  ADD COLUMN IF NOT EXISTS confirmed_by            uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_match         boolean,
  ADD COLUMN IF NOT EXISTS error                   text;

-- Best-effort FK to expediente_documentos. If the target table or
-- column does not exist in a given environment, we skip rather than
-- fail the migration.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'expediente_documentos'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dc_expediente_document_fk'
  ) THEN
    BEGIN
      ALTER TABLE document_classifications
        ADD CONSTRAINT dc_expediente_document_fk
        FOREIGN KEY (expediente_document_id)
        REFERENCES expediente_documentos(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      -- Type mismatch or similar — skip; column remains unconstrained.
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doc_class_company
  ON document_classifications(company_id)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_class_exp_doc
  ON document_classifications(expediente_document_id)
  WHERE expediente_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_class_invoice_bank
  ON document_classifications(invoice_bank_id)
  WHERE invoice_bank_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_class_classified_at
  ON document_classifications(classified_at DESC);

-- RLS — tenant isolation by app.company_id. Service role bypasses.
ALTER TABLE document_classifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_classifications'
      AND policyname = 'doc_class_tenant_scope'
  ) THEN
    CREATE POLICY doc_class_tenant_scope ON document_classifications
      FOR SELECT USING (
        company_id IS NULL
        OR company_id = current_setting('app.company_id', true)
      );
  END IF;
END $$;

COMMENT ON TABLE document_classifications IS
  'AGUILA · document auto-classification — Claude Vision extraction output. Shared with pipeline doc-classifier.';

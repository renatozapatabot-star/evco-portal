-- Block 4 · Supplier Doc Solicitation Polish
-- Recon-aligned document type catalog: adds catalog code, category, and
-- custom-name columns to expediente_documentos. Idempotent: every ADD and
-- CREATE uses IF NOT EXISTS, so the migration is safe to re-run.
--
-- Existing `document_type` (vision classifier) + `doc_type` (legacy free text)
-- columns are preserved. New writes populate `doc_type_code`. Gradual
-- migration of historical rows deferred to a follow-up block.
--
-- RLS: expediente_documentos already has RLS enforced by prior migrations;
-- this change is additive and inherits policies unchanged.

ALTER TABLE expediente_documentos
  ADD COLUMN IF NOT EXISTS doc_type_code text,
  ADD COLUMN IF NOT EXISTS doc_category text,
  ADD COLUMN IF NOT EXISTS custom_doc_name text;

CREATE INDEX IF NOT EXISTS idx_expediente_doc_type_code
  ON expediente_documentos(doc_type_code);

CREATE INDEX IF NOT EXISTS idx_expediente_doc_category
  ON expediente_documentos(doc_category);

CREATE INDEX IF NOT EXISTS idx_expediente_custom_doc
  ON expediente_documentos(custom_doc_name)
  WHERE custom_doc_name IS NOT NULL;

COMMENT ON COLUMN expediente_documentos.doc_type_code IS
  'Code from DOCUMENT_TYPE_CATEGORIES catalog in src/lib/document-types.ts. NULL for legacy rows pre-Block-4.';
COMMENT ON COLUMN expediente_documentos.doc_category IS
  'One of: COMERCIAL | TRANSPORTE | ORIGEN | REGULATORIO | TECNICO | FISCAL | ADUANAL | FINANCIERO | OTROS';
COMMENT ON COLUMN expediente_documentos.custom_doc_name IS
  'User-specified name when doc_type_code=otro. NULL otherwise.';

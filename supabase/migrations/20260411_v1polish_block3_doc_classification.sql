-- ═══════════════════════════════════════════════════════════════
-- V1 Polish Pack · Block 3 — document classification columns
-- Stores Claude vision classifier output on expediente_documentos.
-- `document_type` is additive even if existing rows use `doc_type`;
-- Block 3 writes to `document_type` to avoid stomping legacy values.
-- `document_type_confidence` is 0..1 (numeric). Populated by the
-- classify API; NULL means not classified yet or fell back to
-- 'pending_manual' when Anthropic errored.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE expediente_documentos
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE expediente_documentos
  ADD COLUMN IF NOT EXISTS document_type_confidence numeric;

-- Index for lookups by type (checklist / audits / shadow analysis)
CREATE INDEX IF NOT EXISTS idx_expediente_documentos_document_type
  ON expediente_documentos (document_type);

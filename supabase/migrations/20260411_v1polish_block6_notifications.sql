-- ═══════════════════════════════════════════════════════════════
-- V1 Polish Pack · Block 6 — Notifications augmentation
-- Reuses existing `notifications` table (legacy schema). Adds the
-- recipient_key composite + entity columns needed by the bell and
-- trafico-note workflows. All additive; no destructive changes.
-- RLS remains as configured upstream.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_key TEXT,
  ADD COLUMN IF NOT EXISTS entity_type   TEXT,
  ADD COLUMN IF NOT EXISTS entity_id     TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_key
  ON notifications (recipient_key, created_at DESC)
  WHERE recipient_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

COMMENT ON COLUMN notifications.recipient_key IS
  'V1 Polish Pack · Block 6 — composite user id ({companyId}:{role}) for direct-address notifications (e.g. @mentions).';

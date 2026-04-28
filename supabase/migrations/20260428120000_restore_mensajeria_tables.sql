-- Restore mensajeria + mve_alerts tables.
--
-- Origin: 20260415083503_mve_mensajeria_tables.sql, parked in
-- supabase/migrations_broken_20260420_1500/ during the 2026-04-20
-- migrations reorg and never re-applied to the live project.
-- Discovered 2026-04-28 when scripts/mensajeria-email-fallback.js
-- was crashing every 5 min via PM2 with PGRST205 on
-- public.mensajeria_messages.
--
-- This migration is the original three-table set with two additions
-- the live code requires that the original missed:
--   - mensajeria_messages.undone (boolean) — written by
--     src/lib/mensajeria/threads.ts:438, read by
--     scripts/mensajeria-email-fallback.js:64
--   - mensajeria_reads — read+upserted by threads.ts:54,314
--   - mensajeria_email_notifications — idempotency table for the
--     PM2 cron at scripts/mensajeria-email-fallback.js
--
-- All CREATEs are idempotent (IF NOT EXISTS).

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- mve_alerts
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mve_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id  text NOT NULL,
  trafico_id    text,
  company_id    text NOT NULL,
  rule_code     text,
  severity      text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  deadline_at   timestamptz NOT NULL,
  days_remaining integer,
  message       text,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  resolved_by   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mve_alerts_company_resolved_idx
  ON mve_alerts (company_id, resolved);
CREATE INDEX IF NOT EXISTS mve_alerts_severity_resolved_idx
  ON mve_alerts (severity, resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS mve_alerts_pedimento_deadline_idx
  ON mve_alerts (pedimento_id, deadline_at);
CREATE INDEX IF NOT EXISTS mve_alerts_deadline_idx
  ON mve_alerts (deadline_at) WHERE resolved = false;

ALTER TABLE mve_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mve_alerts_tenant_read"   ON mve_alerts;
DROP POLICY IF EXISTS "mve_alerts_tenant_update" ON mve_alerts;

CREATE POLICY "mve_alerts_tenant_read"
  ON mve_alerts FOR SELECT
  USING (company_id = current_setting('app.company_id', true));

CREATE POLICY "mve_alerts_tenant_update"
  ON mve_alerts FOR UPDATE
  USING (company_id = current_setting('app.company_id', true));

-- ────────────────────────────────────────────────────────────────────────
-- mensajeria_threads
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_threads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            text NOT NULL,
  subject               text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'resolved')),
  trafico_id            text,
  created_by_role       text NOT NULL,
  created_by_name       text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  escalated_at          timestamptz,
  resolved_at           timestamptz,
  last_message_at       timestamptz,
  last_message_preview  text,
  unread_count_client   integer NOT NULL DEFAULT 0,
  unread_count_internal integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS mensajeria_threads_company_status_idx
  ON mensajeria_threads (company_id, status, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS mensajeria_threads_trafico_idx
  ON mensajeria_threads (company_id, trafico_id) WHERE trafico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mensajeria_threads_status_escalated_idx
  ON mensajeria_threads (status, escalated_at DESC NULLS LAST) WHERE status = 'escalated';

ALTER TABLE mensajeria_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajeria_threads_tenant_read"   ON mensajeria_threads;
DROP POLICY IF EXISTS "mensajeria_threads_tenant_update" ON mensajeria_threads;

CREATE POLICY "mensajeria_threads_tenant_read"
  ON mensajeria_threads FOR SELECT
  USING (company_id = current_setting('app.company_id', true)
         OR company_id = 'internal');

CREATE POLICY "mensajeria_threads_tenant_update"
  ON mensajeria_threads FOR UPDATE
  USING (company_id = current_setting('app.company_id', true)
         OR company_id = 'internal');

-- ────────────────────────────────────────────────────────────────────────
-- mensajeria_messages
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES mensajeria_threads(id) ON DELETE CASCADE,
  company_id      text NOT NULL,
  author_role     text NOT NULL,
  author_name     text NOT NULL,
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  internal_only   boolean NOT NULL DEFAULT false,
  undo_until      timestamptz,
  -- The original migration encoded undo as status='undone'. Live code
  -- (src/lib/mensajeria/threads.ts:438) writes a separate boolean
  -- column. Both kept: status carries the broader state model;
  -- undone is the boolean the cron + UI actually use.
  undone          boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'undone', 'redacted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  redacted_at     timestamptz,
  redacted_by     text
);

CREATE INDEX IF NOT EXISTS mensajeria_messages_thread_idx
  ON mensajeria_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mensajeria_messages_company_idx
  ON mensajeria_messages (company_id, created_at DESC);
-- Powers the cron's "client messages older than 30 min, internal_only=false,
-- undone=false" scan + the "internal_only=true, older than 24h" scan.
CREATE INDEX IF NOT EXISTS mensajeria_messages_fallback_scan_idx
  ON mensajeria_messages (internal_only, undone, created_at DESC);

ALTER TABLE mensajeria_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajeria_messages_tenant_read" ON mensajeria_messages;
DROP POLICY IF EXISTS "mensajeria_messages_no_delete"   ON mensajeria_messages;

CREATE POLICY "mensajeria_messages_tenant_read"
  ON mensajeria_messages FOR SELECT
  USING ((company_id = current_setting('app.company_id', true) OR company_id = 'internal')
         AND (internal_only = false
              OR current_setting('app.role', true) IN ('admin', 'broker', 'operator', 'warehouse', 'contabilidad', 'trafico')));

-- Append-only retention lock per CLAUDE.md.
CREATE POLICY "mensajeria_messages_no_delete"
  ON mensajeria_messages FOR DELETE
  USING (false);

-- ────────────────────────────────────────────────────────────────────────
-- mensajeria_reads — per-reader watermark (not in original migration)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_reads (
  thread_id     uuid NOT NULL REFERENCES mensajeria_threads(id) ON DELETE CASCADE,
  reader_key    text NOT NULL,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, reader_key)
);

CREATE INDEX IF NOT EXISTS mensajeria_reads_reader_idx
  ON mensajeria_reads (reader_key, last_read_at DESC);

ALTER TABLE mensajeria_reads ENABLE ROW LEVEL SECURITY;

-- App-layer enforced (HMAC session); deny direct PostgREST access.
-- Service role bypasses RLS — the only writer in practice.
DROP POLICY IF EXISTS "mensajeria_reads_deny_all" ON mensajeria_reads;
CREATE POLICY "mensajeria_reads_deny_all"
  ON mensajeria_reads FOR ALL USING (false);

-- ────────────────────────────────────────────────────────────────────────
-- mensajeria_email_notifications — cron idempotency (not in original)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_email_notifications (
  message_id      uuid NOT NULL REFERENCES mensajeria_messages(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_email)
);

-- Per-recipient rate cap lookback in the cron is `sent_at >= now()-1h`.
CREATE INDEX IF NOT EXISTS mensajeria_email_notifications_recipient_sent_idx
  ON mensajeria_email_notifications (recipient_email, sent_at DESC);

ALTER TABLE mensajeria_email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajeria_email_notifications_deny_all" ON mensajeria_email_notifications;
CREATE POLICY "mensajeria_email_notifications_deny_all"
  ON mensajeria_email_notifications FOR ALL USING (false);

-- ────────────────────────────────────────────────────────────────────────
-- updated_at trigger for mve_alerts and mensajeria_threads
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mve_alerts_updated_at_trg ON mve_alerts;
CREATE TRIGGER mve_alerts_updated_at_trg
  BEFORE UPDATE ON mve_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS mensajeria_threads_updated_at_trg ON mensajeria_threads;
CREATE TRIGGER mensajeria_threads_updated_at_trg
  BEFORE UPDATE ON mensajeria_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

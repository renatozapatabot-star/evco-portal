-- ZAPATA AI · V1 launch prep — create the two missing tables that routines
-- and cockpit queries reference but were never created.
--
-- Discovery 2026-04-15: probe of the production schema showed `mve_alerts`
-- and `mensajeria_threads` returning "Could not find the table 'public.X'
-- in the schema cache" errors. Half-functional code paths were silently
-- failing back to empty arrays via softData/softCount wrappers.
--
-- Schema derived from existing consumer code (no migration to backport from):
--   - src/app/api/mve/scan/route.ts (insert shape)
--   - src/lib/mensajeria/threads.ts (createThread/escalate)
--   - src/lib/mensajeria/types.ts (interfaces)

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

-- Service role bypasses RLS (server-side only). Anon/authenticated:
-- only see their own company's alerts. company_id stored as the
-- session-encoded slug (e.g. 'evco'), matching app-level auth.
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

-- Tenant gate. Internal threads (company_id='internal') readable by any
-- internal-role user — that gate is enforced app-side, RLS just blocks
-- cross-tenant client leakage.
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
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'undone', 'redacted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  redacted_at     timestamptz,
  redacted_by     text
);

CREATE INDEX IF NOT EXISTS mensajeria_messages_thread_idx
  ON mensajeria_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mensajeria_messages_company_idx
  ON mensajeria_messages (company_id, created_at DESC);

ALTER TABLE mensajeria_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajeria_messages_tenant_read"
  ON mensajeria_messages FOR SELECT
  USING ((company_id = current_setting('app.company_id', true) OR company_id = 'internal')
         AND (internal_only = false
              OR current_setting('app.role', true) IN ('admin', 'broker', 'operator', 'warehouse', 'contabilidad', 'trafico')));

-- Append-only retention lock per CLAUDE.md ("FOR DELETE USING (false)").
CREATE POLICY "mensajeria_messages_no_delete"
  ON mensajeria_messages FOR DELETE
  USING (false);

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

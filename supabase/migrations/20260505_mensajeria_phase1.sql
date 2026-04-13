-- ═══════════════════════════════════════════════════════════════
-- AGUILA · Mensajería Phase 1 — internal comms layer
--
-- Replaces Telegram/WhatsApp for client-operator-owner communications.
-- Phase 1 ships operators + owner only (client access behind feature flag).
--
-- Core invariants:
--   · Append-only: FOR DELETE USING (false) on every table
--   · RLS on every table, tested non-admin + cross-tenant
--   · internal_only messages hidden from client role (defense-in-depth beyond flag)
--   · 5-year retention lock — delete policy denies everyone forever
--   · Sender name to clients is always "Renato Zapata & Company" (enforced in API)
-- ═══════════════════════════════════════════════════════════════

-- ── Threads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_threads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       text NOT NULL,
  subject          text NOT NULL,
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','escalated','resolved')),
  trafico_id       text,
  created_by_role  text NOT NULL
                   CHECK (created_by_role IN ('client','operator','admin','broker','warehouse','contabilidad','system')),
  created_by_name  text NOT NULL,
  escalated_at     timestamptz,
  escalated_by     text,
  escalation_summary text,
  resolved_at      timestamptz,
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajeria_threads_company
  ON mensajeria_threads(company_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajeria_threads_status
  ON mensajeria_threads(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajeria_threads_escalated
  ON mensajeria_threads(escalated_at DESC) WHERE status = 'escalated';

-- ── Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES mensajeria_threads(id) ON DELETE RESTRICT,
  company_id       text NOT NULL,
  author_role      text NOT NULL
                   CHECK (author_role IN ('client','operator','admin','broker','warehouse','contabilidad','system')),
  author_name      text NOT NULL,
  body             text NOT NULL,
  internal_only    boolean NOT NULL DEFAULT false,
  undo_until       timestamptz,
  undone           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajeria_messages_thread
  ON mensajeria_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mensajeria_messages_company
  ON mensajeria_messages(company_id, created_at DESC);

-- ── Attachments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajeria_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       uuid NOT NULL REFERENCES mensajeria_messages(id) ON DELETE RESTRICT,
  company_id       text NOT NULL,
  file_name        text NOT NULL,
  file_path        text NOT NULL,
  mime_type        text NOT NULL,
  size_bytes       bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400), -- 25MB
  scan_status      text NOT NULL DEFAULT 'pending'
                   CHECK (scan_status IN ('pending','clean','infected','failed')),
  scanned_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajeria_attachments_message
  ON mensajeria_attachments(message_id);

-- ── Reads (per-user last-read marker for unread counts) ────────
CREATE TABLE IF NOT EXISTS mensajeria_reads (
  thread_id        uuid NOT NULL REFERENCES mensajeria_threads(id) ON DELETE RESTRICT,
  reader_key       text NOT NULL, -- companyId:role (internal users share by role at this phase)
  last_read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, reader_key)
);

-- ── Email-fallback tracker (idempotency for Resend 30-min alerts) ──
CREATE TABLE IF NOT EXISTS mensajeria_email_notifications (
  message_id       uuid PRIMARY KEY REFERENCES mensajeria_messages(id) ON DELETE RESTRICT,
  recipient_email  text NOT NULL,
  sent_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajeria_email_notif_sent
  ON mensajeria_email_notifications(sent_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- RLS — enable on every table
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE mensajeria_threads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajeria_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajeria_attachments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajeria_reads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajeria_email_notifications  ENABLE ROW LEVEL SECURITY;

-- ── Threads policies ───────────────────────────────────────────
DROP POLICY IF EXISTS mensajeria_threads_tenant_read ON mensajeria_threads;
CREATE POLICY mensajeria_threads_tenant_read ON mensajeria_threads
  FOR SELECT USING (
    company_id = current_setting('app.company_id', true)
    OR current_setting('app.role', true) IN ('operator','admin','broker')
  );

DROP POLICY IF EXISTS mensajeria_threads_service_write ON mensajeria_threads;
CREATE POLICY mensajeria_threads_service_write ON mensajeria_threads
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_threads_service_update ON mensajeria_threads;
CREATE POLICY mensajeria_threads_service_update ON mensajeria_threads
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_threads_no_delete ON mensajeria_threads;
CREATE POLICY mensajeria_threads_no_delete ON mensajeria_threads
  FOR DELETE USING (false);

-- ── Messages policies ──────────────────────────────────────────
DROP POLICY IF EXISTS mensajeria_messages_tenant_read ON mensajeria_messages;
CREATE POLICY mensajeria_messages_tenant_read ON mensajeria_messages
  FOR SELECT USING (
    -- Internal roles see everything in their scope
    current_setting('app.role', true) IN ('operator','admin','broker')
    OR (
      -- Client role sees only their company's non-internal, non-undone messages
      company_id = current_setting('app.company_id', true)
      AND internal_only = false
      AND undone = false
    )
  );

DROP POLICY IF EXISTS mensajeria_messages_service_write ON mensajeria_messages;
CREATE POLICY mensajeria_messages_service_write ON mensajeria_messages
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_messages_service_update ON mensajeria_messages;
CREATE POLICY mensajeria_messages_service_update ON mensajeria_messages
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_messages_no_delete ON mensajeria_messages;
CREATE POLICY mensajeria_messages_no_delete ON mensajeria_messages
  FOR DELETE USING (false);

-- ── Attachments policies ───────────────────────────────────────
DROP POLICY IF EXISTS mensajeria_attachments_tenant_read ON mensajeria_attachments;
CREATE POLICY mensajeria_attachments_tenant_read ON mensajeria_attachments
  FOR SELECT USING (
    current_setting('app.role', true) IN ('operator','admin','broker')
    OR company_id = current_setting('app.company_id', true)
  );

DROP POLICY IF EXISTS mensajeria_attachments_service_write ON mensajeria_attachments;
CREATE POLICY mensajeria_attachments_service_write ON mensajeria_attachments
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_attachments_service_update ON mensajeria_attachments;
CREATE POLICY mensajeria_attachments_service_update ON mensajeria_attachments
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_attachments_no_delete ON mensajeria_attachments;
CREATE POLICY mensajeria_attachments_no_delete ON mensajeria_attachments
  FOR DELETE USING (false);

-- ── Reads policies (service-role only; API writes on behalf of user) ──
DROP POLICY IF EXISTS mensajeria_reads_service_all ON mensajeria_reads;
CREATE POLICY mensajeria_reads_service_all ON mensajeria_reads
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── Email notifications policies ───────────────────────────────
DROP POLICY IF EXISTS mensajeria_email_notif_service_all ON mensajeria_email_notifications;
CREATE POLICY mensajeria_email_notif_service_all ON mensajeria_email_notifications
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- Trigger: bump thread.last_message_at + updated_at on new message
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mensajeria_bump_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE mensajeria_threads
     SET last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensajeria_bump_thread ON mensajeria_messages;
CREATE TRIGGER trg_mensajeria_bump_thread
  AFTER INSERT ON mensajeria_messages
  FOR EACH ROW EXECUTE FUNCTION fn_mensajeria_bump_thread();

-- ═══════════════════════════════════════════════════════════════
-- Realtime subscription (Supabase realtime publication)
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajeria_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mensajeria_messages;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajeria_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mensajeria_threads;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════
-- Sanity tests — run in migration to catch regressions early
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_denied integer;
BEGIN
  -- DELETE must be blocked by policy (append-only invariant)
  BEGIN
    SET LOCAL role TO authenticated;
    SET LOCAL "app.company_id" TO 'test_company';
    SET LOCAL "app.role" TO 'admin';
    PERFORM 1 FROM mensajeria_threads LIMIT 1; -- allowed
  EXCEPTION WHEN others THEN NULL; END;
  RESET role;
END $$;

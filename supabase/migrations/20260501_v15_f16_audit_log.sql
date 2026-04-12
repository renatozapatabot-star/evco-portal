-- ═══════════════════════════════════════════════════════════════
-- AGUILA V1.5 · F16 — Audit log viewer (DB triggers + tenant RLS)
--
-- Captures INSERT/UPDATE/DELETE on traficos, partidas, pedimentos,
-- clientes as append-only jsonb before/after snapshots. Resolves
-- company_id best-effort and changed_by via auth.uid() or the
-- `app.user_id` session var. Reads scoped by tenant; service role
-- performs all writes.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id               bigserial PRIMARY KEY,
  table_name       text        NOT NULL,
  record_id        text        NOT NULL,
  action           text        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by       uuid,
  company_id       text,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  before_jsonb     jsonb,
  after_jsonb      jsonb,
  ip_address       text,
  user_agent       text
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
  ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_company
  ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
  ON audit_log(changed_by);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'audit_log_tenant_read'
  ) THEN
    CREATE POLICY audit_log_tenant_read ON audit_log
      FOR SELECT USING (
        company_id IS NULL
        OR company_id = current_setting('app.company_id', true)
      );
  END IF;
END $$;

-- ── Trigger function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action       text;
  v_record_id    text;
  v_before       jsonb;
  v_after        jsonb;
  v_company_id   text;
  v_changed_by   uuid;
  v_record       jsonb;
BEGIN
  v_action := TG_OP;

  IF v_action = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_record := v_before;
  ELSIF v_action = 'INSERT' THEN
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_record := v_after;
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_record := v_after;
  END IF;

  -- Record id: prefer id, fall back to trafico/pedimento identifiers
  v_record_id := COALESCE(
    v_record->>'id',
    v_record->>'trafico_id',
    v_record->>'pedimento_id',
    v_record->>'uuid'
  );

  -- Company id: direct column, else session setting
  v_company_id := COALESCE(
    v_record->>'company_id',
    NULLIF(current_setting('app.company_id', true), '')
  );

  -- changed_by: prefer auth.uid() if available, else app.user_id setting
  BEGIN
    v_changed_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  IF v_changed_by IS NULL THEN
    BEGIN
      v_changed_by := NULLIF(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_changed_by := NULL;
    END;
  END IF;

  INSERT INTO audit_log (
    table_name, record_id, action, changed_by, company_id,
    before_jsonb, after_jsonb
  ) VALUES (
    TG_TABLE_NAME, COALESCE(v_record_id, ''), v_action,
    v_changed_by, v_company_id,
    v_before, v_after
  );

  IF v_action = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ── Attach triggers to target tables (idempotent) ──────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['traficos','partidas','pedimentos','clientes']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_audit_%I ON %I',
        t, t
      );
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
           AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE audit_log IS
  'AGUILA V1.5 F16 · append-only audit trail — triggers on traficos/partidas/pedimentos/clientes.';

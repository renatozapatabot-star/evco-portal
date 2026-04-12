-- ═══════════════════════════════════════════════════════════════
-- V1 Polish Pack · Block 1 — trafico_notes
-- Operator/broker notes on a tráfico detail page, with @mentions.
-- Author / mention identity uses the composite `{companyId}:{role}`
-- format from the signed session — see src/lib/session.ts.
-- Writes go through server actions using the service role, so RLS
-- here is the belt-and-suspenders service-role-only gate.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trafico_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id  text NOT NULL,
  author_id   text NOT NULL,
  content     text NOT NULL,
  mentions    text[] DEFAULT ARRAY[]::text[],
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trafico_notes_trafico
  ON trafico_notes (trafico_id, created_at DESC);

ALTER TABLE trafico_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trafico_notes'
      AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON trafico_notes
      FOR ALL
      USING  (current_setting('role', true) = 'service_role')
      WITH CHECK (current_setting('role', true) = 'service_role');
  END IF;
END
$$;

COMMENT ON TABLE trafico_notes IS
  'V1 Polish Pack · Block 1 — operator/broker notes on a tráfico. author_id and mentions[] use {companyId}:{role} composite keys.';

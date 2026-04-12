-- Block 1 · Tráfico Detail — trafico_notes re-guard
-- Idempotent re-creation in case the prior B1a migration hasn't landed in all environments.

CREATE TABLE IF NOT EXISTS trafico_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id text NOT NULL,
  author_id text NOT NULL,
  content text NOT NULL,
  mentions text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trafico_notes_trafico ON trafico_notes(trafico_id, created_at DESC);

ALTER TABLE trafico_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trafico_notes' AND policyname='service_role full access') THEN
    CREATE POLICY "service_role full access" ON trafico_notes FOR ALL USING (current_setting('role', true) = 'service_role');
  END IF;
END $$;

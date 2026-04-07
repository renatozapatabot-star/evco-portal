-- Launchpad daily completion tracking
-- Tracks which actions an operator completed or postponed today.
-- Resets daily via action_date key.

CREATE TABLE IF NOT EXISTS launchpad_completions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    text NOT NULL,
  user_id       text,
  action_date   date NOT NULL DEFAULT CURRENT_DATE,
  source_table  text NOT NULL,
  source_id     text NOT NULL,
  status        text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'postponed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, action_date, source_table, source_id)
);

ALTER TABLE launchpad_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_launchpad_completions"
  ON launchpad_completions
  USING (company_id = current_setting('app.client_code', true));

CREATE INDEX idx_launchpad_comp_lookup
  ON launchpad_completions (company_id, action_date, status);

-- AGUILA v10 — ai_chat_sessions
-- Persists AGUILA Assistant conversations server-side so they survive
-- across devices. Append-only (messages jsonb grows).
-- Scoped to the authenticated user + role + optional company_id.

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  role        text NOT NULL,
  company_id  text,
  title       text,
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated ON ai_chat_sessions(updated_at DESC);

ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Self-read / self-write. user_id matches the session variable set by
-- the server client before each query. Admin/broker bypass via service role.
DROP POLICY IF EXISTS "ai_chat_sessions_self" ON ai_chat_sessions;
CREATE POLICY "ai_chat_sessions_self" ON ai_chat_sessions
  FOR ALL
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

COMMENT ON TABLE ai_chat_sessions IS
  'AGUILA v10 — persistent assistant conversation history. Append-only messages jsonb.';

-- V1.5 F12 · Telegram routing
-- Per-user per-event-kind notification routing. Admins can also configure
-- routes on behalf of team members. Defense-in-depth: RLS + app-level
-- user_id filter, both keyed off auth.uid().
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS telegram_routing (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id     text NOT NULL,
  event_kind  text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_kind)
);

CREATE INDEX IF NOT EXISTS idx_telegram_routing_dispatch
  ON telegram_routing (event_kind, enabled)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_telegram_routing_user
  ON telegram_routing (user_id);

ALTER TABLE telegram_routing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'telegram_routing_read_own') THEN
    CREATE POLICY telegram_routing_read_own ON telegram_routing
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'telegram_routing_update_own') THEN
    CREATE POLICY telegram_routing_update_own ON telegram_routing
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'telegram_routing_insert_own') THEN
    CREATE POLICY telegram_routing_insert_own ON telegram_routing
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'telegram_routing_delete_own') THEN
    CREATE POLICY telegram_routing_delete_own ON telegram_routing
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'telegram_routing_service_role_all') THEN
    CREATE POLICY telegram_routing_service_role_all ON telegram_routing
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

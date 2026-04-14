-- ═══════════════════════════════════════════════════════════════
-- AGUILA · Mensajería push subscriptions
--
-- Stores OneSignal player ids per user_key (internal:role or client:companyId).
-- Service-role-only RLS — never exposed to tenant reads to prevent
-- enumeration of operator identities.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mensajeria_push_subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key             text NOT NULL,
  onesignal_player_id  text NOT NULL,
  platform             text NOT NULL
                        CHECK (platform IN ('web','ios','android')),
  user_agent           text,
  revoked_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_key, onesignal_player_id)
);

CREATE INDEX IF NOT EXISTS idx_mensajeria_push_active
  ON mensajeria_push_subscriptions(user_key)
  WHERE revoked_at IS NULL;

ALTER TABLE mensajeria_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensajeria_push_service_all ON mensajeria_push_subscriptions;
CREATE POLICY mensajeria_push_service_all ON mensajeria_push_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mensajeria_push_no_delete ON mensajeria_push_subscriptions;
CREATE POLICY mensajeria_push_no_delete ON mensajeria_push_subscriptions
  FOR DELETE USING (false);

-- ═══════════════════════════════════════════════════════════════
-- Email fallback rate-limit tracker (per recipient, rolling window)
-- ═══════════════════════════════════════════════════════════════

-- mensajeria_email_notifications already exists (20260505 migration).
-- Add an index to support the oldest-first + per-recipient rate query.

CREATE INDEX IF NOT EXISTS idx_mensajeria_email_notif_recipient
  ON mensajeria_email_notifications(recipient_email, sent_at DESC);

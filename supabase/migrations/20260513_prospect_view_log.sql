-- 20260513_prospect_view_log.sql
--
-- Tracking infrastructure for the /prospect/[token] surface (Tito's
-- prospect-acquisition cockpit). Two pieces:
--
--   1. prospect_view_log — append-only event stream for token opens,
--      AI chat messages, CTA clicks, and conversion events. Lets Tito
--      see who's engaging without reading raw audit_log.
--
--   2. prospect_link_issuance — record of every magic link Tito has
--      generated (RFC, token hash, expiry, when sent, last viewed).
--      Independent of trade_prospects so the prospect cockpit works
--      even when the build-9 trade_prospects migration hasn't been
--      applied (the script-level migration at scripts/migration-build9-
--      prospects.sql is currently un-applied — see Block FF Phase 0
--      verification).
--
-- RLS: deny-all (FOR ALL USING (false)). Service role bypasses, which
-- is the only path that touches these tables (per the HMAC session
-- pattern documented in .claude/memory/learned-rules.md). No JWT-claim
-- policies because the portal does not use Supabase auth.

CREATE TABLE IF NOT EXISTS prospect_link_issuance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfc             TEXT NOT NULL,
  token_hash      TEXT NOT NULL,
  issued_by       TEXT,                              -- portal session companyId of the issuer
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,                       -- when Tito reports having forwarded it
  last_viewed_at  TIMESTAMPTZ,                       -- updated by /api/prospect/[token]/* on every event
  view_count      INTEGER NOT NULL DEFAULT 0,
  revoked_at      TIMESTAMPTZ,                       -- set when Tito explicitly revokes a link
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospect_link_rfc ON prospect_link_issuance(rfc);
CREATE INDEX IF NOT EXISTS idx_prospect_link_token_hash ON prospect_link_issuance(token_hash);
CREATE INDEX IF NOT EXISTS idx_prospect_link_issued_at ON prospect_link_issuance(issued_at DESC);

ALTER TABLE prospect_link_issuance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY prospect_link_deny_all ON prospect_link_issuance FOR ALL USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS prospect_view_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfc             TEXT NOT NULL,
  token_hash      TEXT,                              -- nullable so we can log even if the issuance row was pruned
  event_type      TEXT NOT NULL,                     -- opened | chat_message | cta_click | tile_focus | revisit
  event_data      JSONB DEFAULT '{}'::jsonb,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_view_log_rfc_created ON prospect_view_log(rfc, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_view_log_token_hash ON prospect_view_log(token_hash);
CREATE INDEX IF NOT EXISTS idx_prospect_view_log_event_type ON prospect_view_log(event_type, created_at DESC);

ALTER TABLE prospect_view_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY prospect_view_log_deny_all ON prospect_view_log FOR ALL USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Convenience view for Tito's engagement dashboard. Joins issuance + view_log
-- so a single query returns "links sent vs. opened vs. converted." Read-only,
-- service-role only (inherits the underlying tables' RLS).
CREATE OR REPLACE VIEW prospect_engagement_summary AS
SELECT
  i.rfc,
  i.id                       AS issuance_id,
  i.token_hash,
  i.issued_at,
  i.expires_at,
  i.sent_at,
  i.last_viewed_at,
  i.view_count,
  i.revoked_at,
  COUNT(v.id) FILTER (WHERE v.event_type = 'opened')        AS open_events,
  COUNT(v.id) FILTER (WHERE v.event_type = 'chat_message')  AS chat_events,
  COUNT(v.id) FILTER (WHERE v.event_type = 'cta_click')     AS cta_events,
  MIN(v.created_at) FILTER (WHERE v.event_type = 'opened')  AS first_open_at,
  MAX(v.created_at) FILTER (WHERE v.event_type = 'opened')  AS most_recent_open_at
FROM prospect_link_issuance i
LEFT JOIN prospect_view_log v ON v.token_hash = i.token_hash
GROUP BY i.id, i.rfc, i.token_hash, i.issued_at, i.expires_at, i.sent_at,
         i.last_viewed_at, i.view_count, i.revoked_at;

-- Optional column on trade_prospects when that table exists. Idempotent —
-- silently skipped if the table hasn't been created yet (build-9 migration
-- pending). This keeps the migration safe to run in any environment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'trade_prospects')
  THEN
    BEGIN
      ALTER TABLE trade_prospects ADD COLUMN IF NOT EXISTS magic_link_issued_at TIMESTAMPTZ;
      ALTER TABLE trade_prospects ADD COLUMN IF NOT EXISTS magic_link_last_viewed_at TIMESTAMPTZ;
      ALTER TABLE trade_prospects ADD COLUMN IF NOT EXISTS magic_link_view_count INTEGER DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping trade_prospects column add: %', SQLERRM;
    END;
  END IF;
END $$;

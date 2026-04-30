-- Leads — sales CRM lite.
--
-- Purpose: track prospect pipeline for the cold-outreach + demo traffic
-- funnel. Every row is a prospect or signed client-in-onboarding.
-- Broker/admin only. Client role never sees this table.
--
-- Normalization is intentionally shallow (single table, no lead_contacts /
-- lead_notes children) — the sales team is 2 people and pg/Supabase can
-- handle the read-fan-out just fine at < 10k rows.
--
-- Invariants:
--   - Every write is by a broker/admin session (enforced at app layer)
--   - RLS is `FOR ALL USING (false)` — only service role reads/writes.
--     Portal route handlers bypass via createServerClient(). No client
--     role should ever see their competitors' prospect records.
--   - audit_log captures every INSERT/UPDATE/DELETE via the existing
--     trigger pattern (application-level, not a DB trigger — consistent
--     with the rest of the codebase).

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  firm_name       text NOT NULL,
  contact_name    text,
  contact_title   text,
  contact_email   text,
  contact_phone   text,
  rfc             text,

  -- Sourcing
  source          text NOT NULL DEFAULT 'cold-email',
    -- 'cold-email' | 'linkedin' | 'referral' | 'demo' | 'inbound' | 'other'
  source_campaign text,
    -- e.g. 'tuesday-2026-04-21' · 'linkedin-wave-1'
  source_url      text,

  -- Pipeline
  stage           text NOT NULL DEFAULT 'new',
    -- 'new' | 'contacted' | 'demo-booked' | 'demo-viewed' |
    -- 'negotiating' | 'won' | 'lost' | 'nurture'
  stage_changed_at timestamptz DEFAULT now(),
  priority        text DEFAULT 'normal',
    -- 'high' | 'normal' | 'low'
  value_monthly_mxn numeric,
    -- estimated monthly revenue if converted

  -- Activity
  last_contact_at   timestamptz,
  next_action_at    timestamptz,
  next_action_note  text,

  -- Context
  industry        text,
    -- 'plastics' | 'automotive' | 'electronics' | 'textiles' | 'other'
  aduana          text,
    -- SAT aduana code or nombre
  volume_note     text,
    -- free-text — "50-100 crossings/mo, NL-SLP corridor"
  notes           text,

  -- Tenant ownership — the broker/admin who owns this lead.
  -- Everybody on the internal team can read everything (role-based),
  -- but assignment helps with round-robin + accountability.
  owner_user_id   uuid,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_stage_idx             ON leads(stage);
CREATE INDEX IF NOT EXISTS leads_source_idx            ON leads(source);
CREATE INDEX IF NOT EXISTS leads_next_action_idx       ON leads(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_owner_idx             ON leads(owner_user_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx        ON leads(created_at DESC);

-- Updated-at trigger (re-use the repo-standard helper if it exists).
CREATE OR REPLACE FUNCTION leads_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  -- Bump stage_changed_at only when stage actually changes
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_touch_updated_at_trg ON leads;
CREATE TRIGGER leads_touch_updated_at_trg
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_touch_updated_at();

-- RLS — deny all. Portal uses HMAC session + service role.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_deny_all ON leads;
CREATE POLICY leads_deny_all ON leads
  FOR ALL
  USING (false);

COMMENT ON TABLE leads IS
  'Sales CRM lite — prospect pipeline for cold outreach + demo traffic. Broker/admin only, service-role bypass.';

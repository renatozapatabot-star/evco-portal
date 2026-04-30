-- Lead activities — append-only timeline for every lead.
--
-- Purpose: give the sales team a chronological record of every touch
-- on a lead — stage changes, field edits, manual call/email/meeting
-- entries, and system notes (like "demo link sent"). Read-mostly;
-- we never UPDATE or DELETE these rows.
--
-- Design:
--   - One row per event. summary is pre-rendered Spanish, ready to
--     show in the UI without post-processing.
--   - metadata is a JSONB sidecar for event-specific extras (e.g.
--     {from: 'new', to: 'contacted'} for stage_change; {field:
--     'value_monthly_mxn', previous: 15000, next: 25000} for
--     field_update). The UI never depends on metadata to render —
--     summary is always enough.
--   - actor_name is denormalized (cached from session.userName at
--     write time) so the UI doesn't need a users join. actor_user_id
--     is the source of truth if you need to chase.
--
-- Invariants:
--   - Broker/admin only. RLS `FOR ALL USING (false)` (service-role
--     bypass only). Client role never sees this table.
--   - Append-only by convention — no app code issues UPDATE or
--     DELETE. There's no trigger enforcing it because a dev
--     occasionally needs to backfill a bad summary by hand.
--   - ON DELETE CASCADE on lead_id — when a lead is purged (rare),
--     its timeline goes with it.

CREATE TABLE IF NOT EXISTS lead_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  kind            text NOT NULL,
    -- 'stage_change'   — auto-logged on stage transition
    -- 'field_update'   — auto-logged on whitelisted field edits
    -- 'note'           — manual free-text
    -- 'call'           — manual call log
    -- 'email_sent'     — manual or system email record
    -- 'email_received' — manual inbound-email record
    -- 'meeting'        — manual meeting record
    -- 'demo_sent'      — system: demo link shared
    -- 'system'         — catch-all for system events

  summary         text NOT NULL,
    -- Pre-rendered Spanish copy. E.g.:
    --   "Etapa: Nuevo → Contactado"
    --   "Valor mensual actualizado: $15,000 → $25,000 MXN"
    --   "Llamada con Juan García — 15 min — decidió pedir demo"

  metadata        jsonb,

  actor_user_id   uuid,
  actor_name      text,
    -- Denormalized at write time. Nullable for system events.

  occurred_at     timestamptz NOT NULL DEFAULT now(),
    -- When the event happened. For manual entries the user may
    -- backdate (call happened this morning, logged this afternoon).
    -- For auto-logs this always equals created_at.

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_occurred_idx
  ON lead_activities(lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS lead_activities_kind_idx
  ON lead_activities(kind);

CREATE INDEX IF NOT EXISTS lead_activities_actor_idx
  ON lead_activities(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- RLS — deny all. Portal uses HMAC session + service role.
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_activities_deny_all ON lead_activities;
CREATE POLICY lead_activities_deny_all ON lead_activities
  FOR ALL
  USING (false);

COMMENT ON TABLE lead_activities IS
  'Append-only timeline for leads — stage changes, field edits, calls, emails, notes. Broker/admin only.';

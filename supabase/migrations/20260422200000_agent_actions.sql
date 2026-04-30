-- Agent actions — propose / 5-second-cancel / commit pipeline
--
-- Purpose: serve two roles in one table.
--   1) The pending-action queue that backs CRUZ AI's write-gated tools
--      (flag_shipment, draft_mensajeria_to_anabel, open_oca_request).
--   2) The append-only audit trail for every action the agent has
--      ever proposed — committed, cancelled, or abandoned.
--
-- Design:
--   - `status` lifecycle: proposed → (committed | cancelled). Once either
--     terminal state is reached, the row is never transitioned back.
--   - `commit_deadline_at` encodes the 5-second cancel window. The UI
--     fires /commit when the deadline passes without cancellation.
--     A future reaper cron can also scan proposed rows past deadline.
--   - `committed` semantics: the user has authorized the action. The
--     REAL downstream side-effect (send mensajeria, flag on traficos,
--     enqueue OCA) is a separate concern — an operator surface or cron
--     reads committed rows and executes. This keeps the HARD approval
--     gate intact ("AGUILA proposes, humans authorize").
--   - `decision_id` links back to `agent_decisions` so the learning loop
--     can correlate (decision → action → outcome).
--
-- Invariants:
--   - `company_id NOT NULL` per Block EE tenant-isolation contract.
--   - RLS `FOR ALL USING (false)` — portal uses HMAC session, not
--     Supabase auth. Service-role bypasses. Pattern per learned-rules.md.
--   - Application layer MUST verify `company_id = session.companyId`
--     on every read + every status transition. DB-level defense only —
--     the app-layer filter is the primary gate.
--   - Append-only. No DELETE path anywhere in the app. Cancel is a
--     status flip, never a delete (matches audit_log + mensajeria rules).

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Ownership
  company_id          text NOT NULL,
  actor_id            text,
  actor_role          text NOT NULL,

  -- Action definition
  kind                text NOT NULL,
  payload             jsonb NOT NULL,
  summary_es          text NOT NULL,

  -- Lifecycle
  status              text NOT NULL DEFAULT 'proposed',
  commit_deadline_at  timestamptz NOT NULL,
  committed_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason_es    text,

  -- Back-reference to the decision log
  decision_id         uuid,

  CONSTRAINT agent_actions_status_check
    CHECK (status IN ('proposed', 'committed', 'cancelled')),
  CONSTRAINT agent_actions_kind_check
    CHECK (kind IN (
      'flag_shipment',
      'draft_mensajeria_to_anabel',
      'open_oca_request'
    ))
);

COMMENT ON TABLE  public.agent_actions IS
  'CRUZ AI pending-action queue + audit trail. status lifecycle: proposed → (committed|cancelled). Commit means USER authorized; downstream side-effect executes separately.';
COMMENT ON COLUMN public.agent_actions.kind IS
  'flag_shipment | draft_mensajeria_to_anabel | open_oca_request. Add new kinds via a new migration + the app-layer Zod schema map.';
COMMENT ON COLUMN public.agent_actions.actor_id IS
  'User / operator id from the HMAC session. NULL allowed for future autonomous agent actions, but today the chat route always attaches the session.';
COMMENT ON COLUMN public.agent_actions.commit_deadline_at IS
  'Proposed-at + 5s. UI auto-commits after this timestamp unless the user clicked Cancel. Documented in CLAUDE.md as the "5-second visible cancellation window".';

-- Query patterns:
--   - "my pending actions": (company_id, status='proposed', created_at DESC)
--   - "reaper sweep": (status='proposed', commit_deadline_at ASC)
CREATE INDEX IF NOT EXISTS agent_actions_company_status_idx
  ON public.agent_actions (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_actions_deadline_idx
  ON public.agent_actions (commit_deadline_at)
  WHERE status = 'proposed';

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

-- No authenticated role ever sees this table — every reader goes through
-- an /api/ route that uses the service role + app-layer company_id filter.
DROP POLICY IF EXISTS agent_actions_deny_all ON public.agent_actions;
CREATE POLICY agent_actions_deny_all
  ON public.agent_actions FOR ALL
  USING (false);

-- Verification (run after the migration, outside the transaction):
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='agent_actions'
--    ORDER BY ordinal_position;
--
--   SELECT policyname, cmd, qual
--     FROM pg_policies
--    WHERE schemaname='public' AND tablename='agent_actions';
--   -- Expect one policy: agent_actions_deny_all · FOR ALL · USING (false).

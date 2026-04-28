-- Agent actions · executed / execute_failed lifecycle
--
-- Why: the parent migration (20260422200000_agent_actions.sql) deliberately
-- stopped at `committed`. `committed` is USER authorization — the actual
-- downstream side-effect (create mensajeria thread, enqueue OCA, flag
-- shipment) is a separate concern executed by the /operador/actions
-- surface or a future reaper cron. This migration records that execution.
--
-- Lifecycle (extended):
--   proposed
--     ├── cancelled
--     └── committed
--           ├── executed         ← downstream side-effect succeeded
--           └── execute_failed   ← transient error; can be retried
--
-- `execute_failed` is NOT terminal — an operator can retry and transition
-- back to `executed`. This is the ONE non-terminal transition in the
-- pipeline. Every other state is terminal. Append-only still holds: no
-- DELETE path, no flip back to `proposed` or `committed`.
--
-- Invariants preserved:
--   - `company_id NOT NULL` per Block EE tenant-isolation contract.
--   - RLS `FOR ALL USING (false)` unchanged — service role only.
--   - Existing (company_id, status, created_at DESC) index still covers
--     the common "pending actions for tenant" query.

ALTER TABLE public.agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_status_check;

ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_status_check
  CHECK (status IN ('proposed', 'committed', 'cancelled', 'executed', 'execute_failed'));

ALTER TABLE public.agent_actions
  ADD COLUMN IF NOT EXISTS executed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS executed_by        text,
  ADD COLUMN IF NOT EXISTS executed_by_role   text,
  ADD COLUMN IF NOT EXISTS execute_attempts   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execute_error_es   text,
  ADD COLUMN IF NOT EXISTS execute_result     jsonb;

COMMENT ON COLUMN public.agent_actions.executed_at IS
  'When the downstream side-effect completed successfully. Set on executed status.';
COMMENT ON COLUMN public.agent_actions.executed_by IS
  'Operator/admin/broker id (from HMAC session) that clicked Execute. NULL for autonomous agent executions (future).';
COMMENT ON COLUMN public.agent_actions.execute_attempts IS
  'Incremented on every /execute call regardless of outcome. Helps spot stuck actions.';
COMMENT ON COLUMN public.agent_actions.execute_error_es IS
  'Human-readable Spanish error. Populated on execute_failed; null on executed.';
COMMENT ON COLUMN public.agent_actions.execute_result IS
  'Downstream artifact refs (e.g. { thread_id, message_id }). Opaque JSON — shape varies by kind.';

-- Operator queue query: "committed or execute_failed, oldest first".
CREATE INDEX IF NOT EXISTS agent_actions_operator_queue_idx
  ON public.agent_actions (status, created_at ASC)
  WHERE status IN ('committed', 'execute_failed');

-- Verification (run manually after apply):
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.agent_actions'::regclass
--      AND conname = 'agent_actions_status_check';
--   -- Expect: CHECK (status = ANY (ARRAY['proposed'…'execute_failed']))
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='agent_actions'
--      AND column_name IN ('executed_at','executed_by','execute_error_es','execute_result');
--   -- Expect: 4 rows.

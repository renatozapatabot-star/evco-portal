-- 20260422120000_agent_decisions_tool_columns.sql
-- Purpose: extend `agent_decisions` with the columns Phase 3 #3 needs to
--          persist every CRUZ AI tool call + capture human feedback +
--          record eventual outcomes for the Phase 3 #5 learning loop.
--
-- Context:
--   Pre-existing columns (from cruz-agent.js + workflow-scoped writers):
--     id, created_at, cycle_id, trigger_type, trigger_id, company_id,
--     workflow, decision, reasoning, confidence, autonomy_level,
--     action_taken, processing_ms.
--
--   Phase 3 #3 adds tool-granular + feedback-capable columns so the
--   Phase 3 #1 natural-language tool layer and the Phase 3 #2 morning
--   briefing can store rich, queryable records. All new columns are
--   NULLABLE so legacy workflow-level rows (cron decisions) coexist
--   without backfill.
--
-- Safety:
--   - All additions are nullable — no data migration required.
--   - `ADD COLUMN IF NOT EXISTS` makes it idempotent (safe to re-run).
--   - `company_id NOT NULL` invariant from the Block EE rollout is
--     preserved — this migration does not weaken any constraint.
--   - Two supporting indexes for the query patterns the logger uses
--     (`getRecentDecisions`, `getDecisionHistory`).

BEGIN;

-- Rich tool-call shape -------------------------------------------------------
ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS tool_name    text,
  ADD COLUMN IF NOT EXISTS tool_input   jsonb,
  ADD COLUMN IF NOT EXISTS tool_output  jsonb;

COMMENT ON COLUMN public.agent_decisions.tool_name IS
  'CRUZ AI tool / agent mode invoked (e.g. analyze_trafico, tenant_anomalies, tenant_scan). NULL for legacy workflow rows.';
COMMENT ON COLUMN public.agent_decisions.tool_input IS
  'Structured input arguments the caller passed. Tenant secrets must NOT be stored here — the tool layer already strips service-role keys.';
COMMENT ON COLUMN public.agent_decisions.tool_output IS
  'Structured response emitted by the tool. Truncated at write time to stay under jsonb limits.';

-- Human feedback (nullable, filled later via an admin action) ---------------
ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS human_feedback jsonb;

COMMENT ON COLUMN public.agent_decisions.human_feedback IS
  'Reviewer sentiment + optional note in Spanish. Shape: { sentiment: "positive"|"negative"|"neutral", note_es?: text, reviewer_id?: text, reviewed_at?: timestamptz, corrected_action_es?: text }. NULL until reviewed.';

-- Actual outcome (nullable, filled by the learning loop) --------------------
ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS outcome              text,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at  timestamptz;

COMMENT ON COLUMN public.agent_decisions.outcome IS
  'Observed outcome once reality arrives — e.g. "verde", "amarillo", "rojo", "approved", "rejected", "ignored". Populated by the Phase 3 #5 learning loop.';
COMMENT ON COLUMN public.agent_decisions.outcome_recorded_at IS
  'When the outcome was recorded (NOT when the decision was made).';

-- Supporting indexes for the logger queries ---------------------------------
-- getRecentDecisions(companyId) — latest N for a tenant, descending.
CREATE INDEX IF NOT EXISTS agent_decisions_company_created_idx
  ON public.agent_decisions (company_id, created_at DESC);

-- getDecisionHistory({ tool_name, … }) — filter by tool + date range.
CREATE INDEX IF NOT EXISTS agent_decisions_tool_created_idx
  ON public.agent_decisions (tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;

COMMIT;

-- Verification (run after the migration, outside the transaction):
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='agent_decisions'
--   ORDER BY ordinal_position;
--
-- -- Expect 6 new rows: tool_name, tool_input, tool_output, human_feedback,
-- -- outcome, outcome_recorded_at — all nullable=YES.

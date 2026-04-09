-- Block J: Proposal Engine — surface_proposals + generation log
-- Run in Supabase SQL Editor to activate

CREATE TABLE IF NOT EXISTS surface_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  company_id TEXT,
  proposal_action TEXT NOT NULL,
  proposal_action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposal_label_es TEXT NOT NULL,
  reasoning_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  confidence_source TEXT NOT NULL DEFAULT 'rule',
  alternatives JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  generator_version TEXT NOT NULL DEFAULT 'v1.0',
  active BOOLEAN DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_surface_proposals_active
  ON surface_proposals(subject_type, subject_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_surface_proposals_company
  ON surface_proposals(company_id, subject_type) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_surface_proposals_expires
  ON surface_proposals(expires_at) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS proposal_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  proposals_generated INTEGER NOT NULL DEFAULT 0,
  rule_based_count INTEGER NOT NULL DEFAULT 0,
  llm_based_count INTEGER NOT NULL DEFAULT 0,
  llm_cost_usd NUMERIC(10,6) DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  confidence_p50 NUMERIC(4,3),
  confidence_p90 NUMERIC(4,3)
);

CREATE INDEX IF NOT EXISTS idx_proposal_log_recent
  ON proposal_generation_log(run_at DESC);

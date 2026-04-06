-- CRUZ 2.0 — Workflow Event Infrastructure
-- The orchestration layer that chains 7 workflows into a single pipeline.
-- Every output becomes the next workflow's input. No dead ends.
-- Patente 3596 · Aduana 240

-- ══════════════════════════════════════════════════════════════════════════
-- 1. workflow_events — append-only event log (the heartbeat of CRUZ 2.0)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow      text NOT NULL,
  event_type    text NOT NULL,
  trigger_id    text,
  company_id    text NOT NULL,
  payload       jsonb DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  completed_at  timestamptz,
  parent_event_id uuid REFERENCES workflow_events(id)
);

-- Constraints
ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter'));

ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_workflow_check
  CHECK (workflow IN ('intake', 'classify', 'docs', 'pedimento', 'crossing', 'post_op', 'invoice'));

-- Indexes for processor polling (status + created_at) and timeline queries
CREATE INDEX idx_workflow_events_pending ON workflow_events (status, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_workflow_events_trigger ON workflow_events (trigger_id, created_at);

CREATE INDEX idx_workflow_events_company ON workflow_events (company_id, created_at);

CREATE INDEX idx_workflow_events_workflow ON workflow_events (workflow, status, created_at);

-- RLS — company_id isolation
ALTER TABLE workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on workflow_events"
  ON workflow_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users see own company workflow events"
  ON workflow_events FOR SELECT
  USING (company_id = current_setting('app.company_id', true));


-- ══════════════════════════════════════════════════════════════════════════
-- 2. workflow_chains — config table mapping event completion → next event
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_chains (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_workflow text NOT NULL,
  source_event    text NOT NULL,
  target_workflow text NOT NULL,
  target_event    text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workflow, source_event, target_workflow, target_event)
);

ALTER TABLE workflow_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on workflow_chains"
  ON workflow_chains FOR ALL
  USING (auth.role() = 'service_role');

-- Seed the chain definitions
INSERT INTO workflow_chains (source_workflow, source_event, target_workflow, target_event, description) VALUES
  -- Intake → Classification
  ('intake', 'email_processed', 'classify', 'product_needs_classification',
   'New email processed → classify extracted products'),

  -- Intake → Docs (attachment received)
  ('intake', 'document_attached', 'docs', 'document_received',
   'Email attachment classified → update expediente completeness'),

  -- Classification complete → trigger duty calculation + portal update
  ('classify', 'classification_complete', 'pedimento', 'duties_calculated',
   'Product classified → calculate DTA + IGI + IVA'),

  -- Classification needs human → no auto-chain (Telegram to Juan José)

  -- Document received → check completeness
  ('docs', 'document_received', 'docs', 'completeness_check',
   'New doc received → recalculate expediente completeness'),

  -- Expediente complete → pedimento preparation
  ('docs', 'expediente_complete', 'pedimento', 'expediente_complete',
   'All docs received → trigger zero-touch pipeline'),

  -- Docs missing → solicitation
  ('docs', 'solicitation_needed', 'docs', 'solicitation_sent',
   'Missing docs identified → send solicitation email'),

  -- Pedimento ready → wait for Tito approval (no auto-chain)

  -- Pedimento approved → crossing
  ('pedimento', 'approved', 'crossing', 'pedimento_paid',
   'Tito approved → dispatch to crossing'),

  -- Crossing complete → post-op
  ('crossing', 'crossing_complete', 'post_op', 'crossing_complete',
   'Truck crossed → score and learn'),

  -- Post-op scored → invoice accumulation
  ('post_op', 'operation_scored', 'invoice', 'operation_accumulated',
   'Operation scored → accumulate for billing')

ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
-- 3. workflow_metrics — aggregated performance tracking
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_metrics (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow      text NOT NULL,
  company_id    text NOT NULL,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  events_total  int NOT NULL DEFAULT 0,
  events_completed int NOT NULL DEFAULT 0,
  events_failed int NOT NULL DEFAULT 0,
  avg_duration_ms bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow, company_id, date)
);

ALTER TABLE workflow_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on workflow_metrics"
  ON workflow_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users see own company workflow metrics"
  ON workflow_metrics FOR SELECT
  USING (company_id = current_setting('app.company_id', true));

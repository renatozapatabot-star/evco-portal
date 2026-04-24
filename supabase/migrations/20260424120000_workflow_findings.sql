-- Daily Driver Workflows — shadow findings + feedback loop.
--
-- Backs the 3 Killer Daily Driver Workflows shipped 2026-04-24:
--   1. missing_nom          — missing NOM certification auto-flag +
--                             Mensajería proposal to supplier.
--   2. high_value_risk      — duplicate shipment / unusual value /
--                             fracción mismatch / audit-risk pattern.
--   3. duplicate_shipment   — same-day same-supplier same-invoice pair
--                             with merge-suggestion payload.
--
-- Lifecycle + guarantees:
--   · Every finding starts with status='shadow'. The runner NEVER
--     sets status to 'proposed' — only Tito or Renato IV sign-off
--     (via a future operator surface) promotes it. The table stores
--     suggestions; it does not trigger side-effects.
--   · One row per (company_id, kind, signature) — re-running the
--     detector updates last_seen_at + bumps confidence; it does not
--     duplicate rows. UPSERT-friendly via the unique index below.
--   · Feedback is append-only in workflow_feedback. The runner reads
--     accumulated thumbs per signature to bias confidence on future
--     findings (see src/lib/workflows/feedback.ts).
--   · company_id NOT NULL per the Block EE tenant-isolation contract.
--   · RLS FOR ALL USING (false) — portal uses HMAC session, not
--     Supabase auth. Service role bypasses. Every read route filters
--     by session.companyId in-app.

CREATE TABLE IF NOT EXISTS public.workflow_findings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),

  -- Ownership
  company_id         text NOT NULL,

  -- Finding classification
  kind               text NOT NULL,
  signature          text NOT NULL,
  severity           text NOT NULL DEFAULT 'info',

  -- Subject (what the finding points at)
  subject_type       text NOT NULL,
  subject_id         text NOT NULL,

  -- Presentation copy (Spanish primary)
  title_es           text NOT NULL,
  detail_es          text NOT NULL,

  -- Structured payloads for the widget + downstream merge UI
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposal           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Confidence + counters
  confidence         numeric(4,3) NOT NULL DEFAULT 0.500,
  seen_count         integer NOT NULL DEFAULT 1,

  -- Shadow-mode lifecycle — shadow → (acknowledged | dismissed | resolved)
  status             text NOT NULL DEFAULT 'shadow',
  resolved_at        timestamptz,
  resolved_by        text,

  -- Detector version so rollouts of new rules don't silently replace
  -- old findings with different semantics.
  detector_version   text NOT NULL DEFAULT 'v1',

  CONSTRAINT workflow_findings_kind_check
    CHECK (kind IN ('missing_nom', 'high_value_risk', 'duplicate_shipment')),
  CONSTRAINT workflow_findings_severity_check
    CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT workflow_findings_status_check
    CHECK (status IN ('shadow', 'acknowledged', 'dismissed', 'resolved')),
  CONSTRAINT workflow_findings_confidence_range
    CHECK (confidence >= 0 AND confidence <= 1)
);

COMMENT ON TABLE  public.workflow_findings IS
  'Shadow-mode findings from the 3 Killer Daily Driver Workflows. AGUILA proposes; humans authorize. No live side-effects triggered from this table.';
COMMENT ON COLUMN public.workflow_findings.signature IS
  'Stable idempotency key within (company_id, kind). Example: missing_nom:trafico:26-24-3596-6500441. Upserts key on (company_id, kind, signature).';
COMMENT ON COLUMN public.workflow_findings.confidence IS
  'Detector confidence in [0,1], blended with feedback priors. Bumped up by 👍, down by 👎 on same signature family.';

CREATE UNIQUE INDEX IF NOT EXISTS workflow_findings_company_kind_signature_uk
  ON public.workflow_findings (company_id, kind, signature);

-- Widget read path: recent active findings per tenant.
CREATE INDEX IF NOT EXISTS workflow_findings_company_status_seen_idx
  ON public.workflow_findings (company_id, status, last_seen_at DESC);

-- Runner read path: prune/age stale findings.
CREATE INDEX IF NOT EXISTS workflow_findings_last_seen_idx
  ON public.workflow_findings (last_seen_at DESC);

ALTER TABLE public.workflow_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_findings_deny_all ON public.workflow_findings;
CREATE POLICY workflow_findings_deny_all
  ON public.workflow_findings FOR ALL
  USING (false);

-- ── Feedback trail ──────────────────────────────────────────────────
--
-- Append-only. Every thumbs up/down + optional comment is a training
-- signal for the detector's confidence blend. Never deleted.

CREATE TABLE IF NOT EXISTS public.workflow_feedback (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),

  finding_id         uuid NOT NULL REFERENCES public.workflow_findings(id) ON DELETE RESTRICT,
  company_id         text NOT NULL,
  kind               text NOT NULL,
  signature          text NOT NULL,

  actor_id           text,
  actor_role         text NOT NULL,
  thumbs             text NOT NULL,
  comment_es         text,

  CONSTRAINT workflow_feedback_thumbs_check
    CHECK (thumbs IN ('up', 'down'))
);

COMMENT ON TABLE public.workflow_feedback IS
  'Append-only feedback on workflow_findings. Trains the detector confidence blend via signature-scoped priors.';

CREATE INDEX IF NOT EXISTS workflow_feedback_finding_idx
  ON public.workflow_feedback (finding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workflow_feedback_signature_idx
  ON public.workflow_feedback (company_id, kind, signature);

ALTER TABLE public.workflow_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_feedback_deny_all ON public.workflow_feedback;
CREATE POLICY workflow_feedback_deny_all
  ON public.workflow_feedback FOR ALL
  USING (false);

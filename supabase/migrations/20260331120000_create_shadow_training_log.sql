-- Shadow training log for Karpathy loop
-- Stores CRUZ draft vs actual outcome comparisons for self-improvement scoring
CREATE TABLE IF NOT EXISTS shadow_training_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account TEXT NOT NULL,
  email_id UUID,
  context_summary TEXT,
  cruz_draft TEXT,
  actual_outcome TEXT,
  completed BOOLEAN,
  completion_ms INTEGER,
  accepted_without_revision BOOLEAN,
  corrections_count INTEGER,
  corrections_content TEXT,
  score_overall NUMERIC,
  used_as_training BOOLEAN DEFAULT false,
  tito_correction BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shadow_training_log ENABLE ROW LEVEL SECURITY;

-- Service role only — pipeline access, never client-facing
CREATE POLICY "svc_all" ON shadow_training_log
  FOR ALL USING (auth.role() = 'service_role');

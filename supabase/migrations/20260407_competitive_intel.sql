-- Build 238: Competitive Intelligence Scanner — daily digest
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS competitive_intel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Classification
  intel_type TEXT NOT NULL CHECK (intel_type IN (
    'competitor_move',      -- Broker hiring, closing, expanding
    'regulatory_change',    -- New rules, fraccion changes, VUCEM updates
    'market_opportunity',   -- Client looking for broker, ABC closed
    'industry_trend',       -- Nearshoring growth, new crossing planned
    'tariff_change'         -- IGI rate changes, new regimes
  )),

  -- Content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT,                -- 'sat_public', 'vucem', 'linkedin', 'news', 'internal'
  source_url TEXT,

  -- Relevance
  relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
  actionable BOOLEAN DEFAULT false,
  suggested_action TEXT,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'acted_on', 'archived')),
  read_at TIMESTAMPTZ,

  -- Dates
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_date DATE,         -- when does this take effect?

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE competitive_intel ENABLE ROW LEVEL SECURITY;

-- Service role only — competitive intel is firm-wide, not per-client
CREATE POLICY "svc_competitive_intel" ON competitive_intel
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_comp_intel_type ON competitive_intel(intel_type, status, detected_at DESC);
CREATE INDEX idx_comp_intel_actionable ON competitive_intel(actionable, status) WHERE actionable = true;

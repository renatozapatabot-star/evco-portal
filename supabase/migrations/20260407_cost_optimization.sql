-- Build 231: Landed Cost Optimizer — per-operation savings insights
-- Patente 3596 · Aduana 240

-- ============================================================================
-- cost_insights: specific savings opportunities found by the optimizer
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,

  -- Insight classification
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'bridge_optimization',      -- Faster bridge for this route
    'filing_timing',            -- FX timing saves money
    'consolidation',            -- Combine shipments
    'supplier_pricing',         -- Supplier charges above network average
    'fraccion_review',          -- Possible better classification
    'regime_optimization'       -- T-MEC or other regime advantage
  )),

  -- Context
  trafico TEXT,                   -- specific tráfico if applicable
  supplier TEXT,
  product_description TEXT,

  -- Savings estimate
  estimated_savings_usd NUMERIC(10,2) NOT NULL,
  estimated_savings_mxn NUMERIC(12,2),
  savings_basis TEXT NOT NULL,    -- human-readable explanation
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),

  -- Detail
  current_value TEXT,             -- what they're doing now
  optimized_value TEXT,           -- what they could do
  detail JSONB,                   -- type-specific data

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'implemented')),
  reviewed_by TEXT,
  implemented_savings_usd NUMERIC(10,2),  -- actual savings if implemented

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate insights for same trafico+type
  UNIQUE(company_id, trafico, insight_type)
);

ALTER TABLE cost_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_cost_insights" ON cost_insights
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_cost_insights" ON cost_insights
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_cost_insights_company ON cost_insights(company_id, status, created_at DESC);

-- ============================================================================
-- operations_savings: monthly aggregate of realized savings per client
-- ============================================================================
CREATE TABLE IF NOT EXISTS operations_savings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  month DATE NOT NULL,              -- first day of month

  insights_generated INTEGER DEFAULT 0,
  insights_implemented INTEGER DEFAULT 0,
  estimated_savings_usd NUMERIC(12,2) DEFAULT 0,
  realized_savings_usd NUMERIC(12,2) DEFAULT 0,

  -- Breakdown by type
  savings_by_type JSONB,            -- {bridge: $X, timing: $Y, ...}

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, month)
);

ALTER TABLE operations_savings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_operations_savings" ON operations_savings
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_operations_savings" ON operations_savings
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_ops_savings_company ON operations_savings(company_id, month DESC);

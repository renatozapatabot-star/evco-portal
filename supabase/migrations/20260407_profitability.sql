-- Build 237: Profitability X-Ray — true profit per client
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS client_profitability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  month DATE NOT NULL,

  -- Revenue
  brokerage_fees_usd NUMERIC(10,2) DEFAULT 0,
  consulting_fees_usd NUMERIC(10,2) DEFAULT 0,
  other_revenue_usd NUMERIC(10,2) DEFAULT 0,
  total_revenue_usd NUMERIC(10,2) DEFAULT 0,

  -- Costs (estimated from operations data)
  staff_time_hours NUMERIC(6,1) DEFAULT 0,
  staff_cost_usd NUMERIC(10,2) DEFAULT 0,
  ai_cost_usd NUMERIC(8,2) DEFAULT 0,
  platform_overhead_usd NUMERIC(8,2) DEFAULT 0,
  total_cost_usd NUMERIC(10,2) DEFAULT 0,

  -- Profit
  net_profit_usd NUMERIC(10,2) DEFAULT 0,
  margin_pct NUMERIC(5,1) DEFAULT 0,

  -- Operations metrics
  operations_count INTEGER DEFAULT 0,
  revenue_per_operation NUMERIC(8,2) DEFAULT 0,
  cost_per_operation NUMERIC(8,2) DEFAULT 0,
  automation_pct NUMERIC(5,1) DEFAULT 0,   -- % of ops handled without human intervention

  -- Computed insights
  insights JSONB,                    -- {tier, growth_signal, churn_risk, recommendation}

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, month)
);

ALTER TABLE client_profitability ENABLE ROW LEVEL SECURITY;

-- Tito-only: service role access only (no client reads)
CREATE POLICY "svc_client_profitability" ON client_profitability
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_profitability_company ON client_profitability(company_id, month DESC);

-- Build 233: Supplier Negotiator — negotiation briefs with leverage data
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS negotiation_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  supplier TEXT NOT NULL,

  -- Your leverage
  total_operations INTEGER,
  total_value_usd NUMERIC(14,2),
  relationship_months INTEGER,
  client_rank_for_supplier INTEGER,    -- rank among supplier's customers in network

  -- Supplier performance
  doc_turnaround_days NUMERIC(4,1),
  compliance_rate_pct NUMERIC(5,1),
  tmec_qualification_pct NUMERIC(5,1),
  late_delivery_pct NUMERIC(5,1),
  pricing_trend TEXT,                  -- 'stable', 'increasing', 'decreasing'

  -- Market context
  supplier_avg_price_usd NUMERIC(10,2),
  network_avg_price_usd NUMERIC(10,2),
  price_vs_market_pct NUMERIC(5,1),    -- positive = above market
  alternative_suppliers JSONB,          -- [{name, avg_price, reliability_score}]

  -- Negotiation strategy
  negotiation_angle TEXT NOT NULL,
  potential_savings_usd NUMERIC(10,2),
  risk_assessment TEXT,
  suggested_message TEXT,              -- Spanish draft

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'reviewed', 'sent', 'successful', 'unsuccessful')),
  outcome_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, supplier)
);

ALTER TABLE negotiation_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_negotiation_briefs" ON negotiation_briefs
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_negotiation_briefs" ON negotiation_briefs
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_neg_briefs_company ON negotiation_briefs(company_id, status);

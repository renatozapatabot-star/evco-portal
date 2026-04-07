-- Build 236: Carrier Intelligence Network — scoring + dispatch recommendations
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS carrier_scoreboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  carrier_name TEXT NOT NULL,

  -- Performance metrics
  total_operations INTEGER DEFAULT 0,
  on_time_rate_pct NUMERIC(5,1),
  avg_cost_per_kg NUMERIC(8,4),
  avg_transit_hours NUMERIC(6,1),
  damage_rate_pct NUMERIC(5,2),

  -- Specialization
  specialization TEXT[],              -- ['refrigerated', 'dry', 'hazmat']
  best_lanes TEXT[],                  -- ['Houston-Monterrey', 'Laredo-CDMX']
  capacity_trend TEXT,                -- 'available', 'tight', 'full'

  -- Reputation
  reputation_score NUMERIC(4,1) CHECK (reputation_score BETWEEN 0 AND 10),
  last_incident TEXT,
  last_incident_date DATE,

  -- Pricing
  avg_rate_per_trip NUMERIC(10,2),
  rate_trend TEXT,                    -- 'stable', 'increasing', 'decreasing'

  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, carrier_name)
);

ALTER TABLE carrier_scoreboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_carrier_scoreboard" ON carrier_scoreboard
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_carrier_scoreboard" ON carrier_scoreboard
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_carrier_company ON carrier_scoreboard(company_id, reputation_score DESC);

-- ============================================================================
-- dispatch_recommendations: per-tráfico carrier recommendations
-- ============================================================================
CREATE TABLE IF NOT EXISTS dispatch_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  trafico TEXT,

  -- Top 3 recommended carriers
  recommendations JSONB NOT NULL,     -- [{rank, carrier, score, rate, eta_hours, reason}]

  -- Context
  route TEXT,                         -- e.g. 'Houston → Monterrey'
  product_type TEXT,
  weight_kg NUMERIC(10,2),

  -- Market rate
  market_rate_low NUMERIC(10,2),
  market_rate_avg NUMERIC(10,2),
  market_rate_high NUMERIC(10,2),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'completed')),
  dispatched_carrier TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, trafico)
);

ALTER TABLE dispatch_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_dispatch_rec" ON dispatch_recommendations
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_dispatch" ON dispatch_recommendations
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_dispatch_company ON dispatch_recommendations(company_id, status);

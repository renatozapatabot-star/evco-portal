-- Client readiness scores — weekly ranking of data quality
CREATE TABLE IF NOT EXISTS client_readiness (
  company_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB,
  ready BOOLEAN DEFAULT false,
  scored_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_readiness ENABLE ROW LEVEL SECURITY;

-- Demand forecasts table (used by demand-forecast.js)
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  forecast_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, forecast_date)
);

ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;

-- Tariff rates per fraccion arancelaria
-- Stores effective IGI rates derived from historical aduanet_facturas
-- or manually entered from TIGIE/SAT sources

CREATE TABLE IF NOT EXISTS tariff_rates (
  fraccion TEXT PRIMARY KEY,
  igi_rate NUMERIC NOT NULL DEFAULT 0,    -- effective rate 0.00-1.00 (e.g. 0.05 = 5%)
  sample_count INTEGER DEFAULT 0,          -- number of historical pedimentos used to derive rate
  source TEXT NOT NULL DEFAULT 'historical_aduanet',  -- 'historical_aduanet', 'tigie', 'manual'
  valid_from DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tariff_rates ENABLE ROW LEVEL SECURITY;

-- Public read access (tariff rates are not client-specific)
CREATE POLICY "tariff_rates_read" ON tariff_rates
  FOR SELECT USING (true);

-- Only service role can write
CREATE POLICY "tariff_rates_service_write" ON tariff_rates
  FOR ALL USING (auth.role() = 'service_role');

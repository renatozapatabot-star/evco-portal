-- CRUZ Client Request System
-- Allows clients to submit quote requests and change requests through the portal.
-- All requests go through Tito/Renato IV approval via Telegram.

CREATE TABLE IF NOT EXISTS quote_requests (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_description TEXT NOT NULL,
  fraccion TEXT,
  origin_country TEXT DEFAULT 'US',
  estimated_value_usd NUMERIC(14,2),
  incoterm TEXT DEFAULT 'EXW',
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'approved', 'rejected')),
  response_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS change_requests (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  trafico_id TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('correction', 'reschedule', 'cancel', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  response_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_quote_requests_company ON quote_requests(company_id, status);
CREATE INDEX idx_change_requests_company ON change_requests(company_id, status);

-- RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_quote_requests" ON quote_requests
  FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "read_own_quote_requests" ON quote_requests
  FOR SELECT USING (true);
CREATE POLICY "insert_quote_requests" ON quote_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_all_change_requests" ON change_requests
  FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "read_own_change_requests" ON change_requests
  FOR SELECT USING (true);
CREATE POLICY "insert_change_requests" ON change_requests
  FOR INSERT WITH CHECK (true);

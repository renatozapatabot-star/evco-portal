-- CRUZ Build 216: Carrier Coordinator — dispatch tracking
-- Tracks WhatsApp dispatch messages to carriers and their responses

CREATE TABLE IF NOT EXISTS carrier_dispatches (
  id BIGSERIAL PRIMARY KEY,
  trafico_id TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  carrier_phone TEXT,
  status TEXT NOT NULL DEFAULT 'dispatched'
    CHECK (status IN ('dispatched', 'confirmed', 'declined', 'expired', 'cancelled')),
  company_id TEXT NOT NULL,
  message_sent TEXT,
  response_text TEXT,
  dispatched_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE carrier_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_write_carrier_dispatches" ON carrier_dispatches
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "company_read_carrier_dispatches" ON carrier_dispatches
  FOR SELECT USING (company_id = current_setting('app.company_id', true));

CREATE INDEX idx_carrier_dispatches_trafico ON carrier_dispatches(trafico_id, status);
CREATE INDEX idx_carrier_dispatches_company ON carrier_dispatches(company_id, dispatched_at DESC);

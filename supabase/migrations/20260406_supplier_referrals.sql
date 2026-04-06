-- Supplier referral tracking — every upload is a marketing touch

CREATE TABLE IF NOT EXISTS supplier_referrals (
  id BIGSERIAL PRIMARY KEY,
  supplier_name TEXT,
  supplier_company TEXT,
  client_company_id TEXT,
  source_token TEXT,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_action ON supplier_referrals(action);
ALTER TABLE supplier_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_referrals" ON supplier_referrals
  FOR ALL USING (current_setting('role', true) = 'service_role');

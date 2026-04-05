-- Trial client tracking — 30-day portal access for prospective clients.

CREATE TABLE IF NOT EXISTS trial_clients (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT now(),
  trial_ends_at TIMESTAMPTZ DEFAULT now() + interval '30 days',
  activated_by TEXT DEFAULT 'system',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),
  login_count INTEGER DEFAULT 0,
  last_login TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trial_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_trial_clients" ON trial_clients
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_trial_company ON trial_clients (company_id);
CREATE INDEX idx_trial_status ON trial_clients (status) WHERE status = 'active';

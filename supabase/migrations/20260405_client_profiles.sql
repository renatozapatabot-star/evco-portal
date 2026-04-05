-- Client intelligence profiles — living data that makes every interaction smarter
CREATE TABLE IF NOT EXISTS client_profiles (
  company_id TEXT PRIMARY KEY,
  profile_data JSONB NOT NULL,
  churn_risk TEXT DEFAULT 'low',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

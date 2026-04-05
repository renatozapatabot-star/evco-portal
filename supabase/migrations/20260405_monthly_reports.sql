-- Monthly client reports — generated 1st of each month
CREATE TABLE IF NOT EXISTS monthly_reports (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  month DATE NOT NULL,
  report_data JSONB NOT NULL,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  approved_by TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, month)
);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

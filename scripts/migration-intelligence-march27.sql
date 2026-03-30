-- CRUZ Intelligence Platform Migrations — March 27, 2026
-- Run in Supabase SQL Editor

-- Feature 11: Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  endpoint TEXT UNIQUE,
  auth TEXT,
  p256dh TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature 11: Service Requests
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  request_type TEXT,
  description TEXT,
  status TEXT DEFAULT 'recibido',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all push_subscriptions" ON push_subscriptions FOR ALL USING (true);
CREATE POLICY "Allow all service_requests" ON service_requests FOR ALL USING (true);

-- Add unique constraints needed for upserts
-- (Only run if the tables don't have them already)
DO $$ BEGIN
  ALTER TABLE pedimento_risk_scores ADD CONSTRAINT pedimento_risk_scores_trafico_id_key UNIQUE (trafico_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crossing_predictions ADD CONSTRAINT crossing_predictions_trafico_id_key UNIQUE (trafico_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_benchmarks ADD CONSTRAINT client_benchmarks_company_period_key UNIQUE (company_id, period);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE monthly_intelligence_reports ADD CONSTRAINT monthly_reports_company_period_key UNIQUE (company_id, period);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;

-- Add resolved column to compliance_predictions if missing
DO $$ BEGIN
  ALTER TABLE compliance_predictions ADD COLUMN resolved BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compliance_predictions ADD COLUMN due_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compliance_predictions ADD COLUMN severity TEXT DEFAULT 'info';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compliance_predictions ADD COLUMN days_until INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compliance_predictions ADD COLUMN trafico_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

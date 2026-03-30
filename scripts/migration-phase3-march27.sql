-- CRUZ Intelligence Platform — Phase 3 Migrations
-- March 27, 2026
-- Run in Supabase SQL Editor

-- Rate Quotes table
CREATE TABLE IF NOT EXISTS rate_quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  fraccion TEXT,
  product_description TEXT,
  declared_value_usd DECIMAL(14,2),
  estimated_dta DECIMAL(14,2),
  estimated_igi DECIMAL(14,2),
  estimated_iva DECIMAL(14,2),
  tmec_applicable BOOLEAN,
  tmec_savings DECIMAL(14,2),
  status TEXT DEFAULT 'quoted',
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  url TEXT NOT NULL,
  events TEXT[],
  secret TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subscription_id UUID REFERENCES webhook_subscriptions(id),
  event_type TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE rate_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_rate_quotes" ON rate_quotes FOR ALL USING (true);
CREATE POLICY "anon_rate_quotes" ON rate_quotes FOR SELECT USING (true);
CREATE POLICY "service_webhooks" ON webhook_subscriptions FOR ALL USING (true);
CREATE POLICY "anon_webhooks" ON webhook_subscriptions FOR SELECT USING (true);
CREATE POLICY "service_deliveries" ON webhook_deliveries FOR ALL USING (true);
CREATE POLICY "anon_deliveries" ON webhook_deliveries FOR SELECT USING (true);

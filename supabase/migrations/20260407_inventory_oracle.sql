-- Build 230: Inventory Oracle — consumption inference + stockout prediction
-- Tables: inventory_estimates, reorder_alerts
-- Patente 3596 · Aduana 240

-- ============================================================================
-- inventory_estimates: per-client per-product consumption & coverage estimates
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_key TEXT NOT NULL,          -- normalized description or fraccion
  product_description TEXT NOT NULL,

  -- Consumption inference
  avg_monthly_kg NUMERIC(12,2),       -- estimated monthly consumption in kg
  avg_monthly_usd NUMERIC(12,2),      -- estimated monthly cost
  avg_shipment_kg NUMERIC(10,2),      -- typical shipment size
  shipment_frequency_days NUMERIC(6,1), -- avg days between shipments

  -- Current estimate
  last_shipment_date DATE,
  last_shipment_kg NUMERIC(10,2),
  estimated_remaining_kg NUMERIC(10,2),
  days_of_cover INTEGER,              -- estimated days until stockout
  reorder_date DATE,                  -- recommended date to reorder
  depletion_date DATE,                -- estimated stockout date

  -- Supplier context
  primary_supplier TEXT,
  supplier_lead_time_days INTEGER,    -- avg days from order to delivery
  supplier_doc_time_days INTEGER,     -- avg days for documentation

  -- Confidence
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  sample_size INTEGER NOT NULL,

  -- Risk level
  risk_level TEXT NOT NULL DEFAULT 'ok'
    CHECK (risk_level IN ('ok', 'watch', 'warning', 'critical')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, product_key)
);

ALTER TABLE inventory_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_inventory_estimates" ON inventory_estimates
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_inventory_estimates" ON inventory_estimates
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_inv_est_company ON inventory_estimates(company_id, risk_level);
CREATE INDEX idx_inv_est_reorder ON inventory_estimates(reorder_date) WHERE risk_level IN ('warning', 'critical');

-- ============================================================================
-- reorder_alerts: proactive alerts sent to clients about predicted stockouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS reorder_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  inventory_estimate_id UUID REFERENCES inventory_estimates(id),
  product_key TEXT NOT NULL,
  product_description TEXT NOT NULL,
  primary_supplier TEXT,

  -- Alert details
  days_of_cover INTEGER NOT NULL,
  estimated_remaining_kg NUMERIC(10,2),
  reorder_date DATE,
  depletion_date DATE,
  alert_message TEXT NOT NULL,        -- Spanish message for client

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'acknowledged', 'dismissed')),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reorder_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_reorder_alerts" ON reorder_alerts
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_reorder_alerts" ON reorder_alerts
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_reorder_company ON reorder_alerts(company_id, status);

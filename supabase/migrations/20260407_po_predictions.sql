-- Build 229: PO Predictor — granular shipment predictions with lifecycle tracking
-- Tables: po_predictions, staged_traficos, po_prediction_accuracy
-- Patente 3596 · Aduana 240

-- ============================================================================
-- po_predictions: per-supplier shipment predictions with matching lifecycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS po_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  supplier TEXT NOT NULL,

  -- Timing prediction
  predicted_date DATE NOT NULL,
  predicted_date_low DATE,
  predicted_date_high DATE,
  avg_frequency_days NUMERIC(6,1),
  std_deviation_days NUMERIC(6,1),

  -- Value prediction
  predicted_value_usd NUMERIC(12,2),
  value_low_usd NUMERIC(12,2),
  value_high_usd NUMERIC(12,2),

  -- Product prediction
  predicted_products JSONB,         -- [{description, fraccion, qty_kg, unit_price}]
  predicted_weight_kg NUMERIC(10,2),

  -- Duty pre-calculation
  estimated_duties JSONB,           -- {dta, igi, iva, total_mxn, exchange_rate, calculated_at}

  -- Crossing optimization
  optimal_crossing JSONB,           -- {dow, dow_name, window, estimated_hours}

  -- Metadata
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  sample_size INTEGER NOT NULL,
  last_shipment_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'matched', 'expired', 'missed')),

  -- Match tracking
  matched_trafico TEXT,
  matched_at TIMESTAMPTZ,
  match_score NUMERIC(4,2),
  match_details JSONB,              -- {timing_match, value_match, product_match, diff}

  -- Accuracy (filled by feedback loop)
  actual_date DATE,
  actual_value_usd NUMERIC(12,2),
  timing_error_days INTEGER,
  value_error_pct NUMERIC(5,2),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, supplier, predicted_date)
);

ALTER TABLE po_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_po_predictions" ON po_predictions
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_po_predictions" ON po_predictions
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_po_pred_active
  ON po_predictions(status, predicted_date)
  WHERE status = 'active';

CREATE INDEX idx_po_pred_company
  ON po_predictions(company_id, status);

-- ============================================================================
-- staged_traficos: pre-filled shipment skeletons awaiting PO confirmation
-- ============================================================================
CREATE TABLE IF NOT EXISTS staged_traficos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  po_prediction_id UUID REFERENCES po_predictions(id),

  -- Pre-filled tráfico fields
  supplier TEXT,
  descripcion_mercancia TEXT,
  importe_total NUMERIC(14,2),
  peso_bruto NUMERIC(10,2),
  productos JSONB,                  -- [{description, fraccion, qty_kg, unit_price}]

  -- Duty estimate
  estimated_duties JSONB,           -- {dta, igi, iva, total_mxn, exchange_rate}

  -- Crossing recommendation
  recommended_crossing JSONB,       -- {dow_name, window, estimated_hours}

  -- Draft communications
  supplier_notification_draft TEXT,
  carrier_alert_draft TEXT,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'promoted', 'expired', 'rejected')),
  promoted_trafico_id TEXT,
  promoted_at TIMESTAMPTZ,
  promoted_by TEXT,                  -- 'auto' or user ID

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staged_traficos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_staged_traficos" ON staged_traficos
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_staged_traficos" ON staged_traficos
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_staged_active
  ON staged_traficos(company_id, status)
  WHERE status = 'staged';

CREATE INDEX idx_staged_prediction
  ON staged_traficos(po_prediction_id);

-- ============================================================================
-- po_prediction_accuracy: append-only accuracy log for model improvement
-- ============================================================================
CREATE TABLE IF NOT EXISTS po_prediction_accuracy (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  supplier TEXT NOT NULL,
  prediction_id UUID REFERENCES po_predictions(id),

  predicted_date DATE,
  actual_date DATE,
  timing_error_days INTEGER,

  predicted_value_usd NUMERIC(12,2),
  actual_value_usd NUMERIC(12,2),
  value_error_pct NUMERIC(5,2),

  product_match_pct NUMERIC(5,2),
  overall_score NUMERIC(4,2),       -- 0.0 to 1.0

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE po_prediction_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_po_accuracy" ON po_prediction_accuracy
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_po_accuracy_company
  ON po_prediction_accuracy(company_id, created_at DESC);

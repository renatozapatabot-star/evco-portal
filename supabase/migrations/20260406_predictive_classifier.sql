-- Predictive classifier columns on traficos
-- CRUZ predicts fracción before shipment is classified

ALTER TABLE traficos ADD COLUMN IF NOT EXISTS predicted_fraccion TEXT;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS predicted_igi NUMERIC;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS predicted_tmec BOOLEAN;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS predicted_landed_cost NUMERIC;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS prediction_confidence NUMERIC;
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS predicted_at TIMESTAMPTZ;

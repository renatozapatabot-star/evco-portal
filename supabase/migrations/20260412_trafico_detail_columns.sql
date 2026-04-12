-- Block 1 · Tráfico Detail — below-fold columns
-- Adds fields rendered in the progressive-disclosure sections of the new detail page.
-- All nullable; existing rows unaffected.

ALTER TABLE traficos
  ADD COLUMN IF NOT EXISTS doda_status text,
  ADD COLUMN IF NOT EXISTS u_level text,
  ADD COLUMN IF NOT EXISTS peso_volumetrico numeric,
  ADD COLUMN IF NOT EXISTS prevalidador text,
  ADD COLUMN IF NOT EXISTS banco_operacion_numero text,
  ADD COLUMN IF NOT EXISTS sat_transaccion_numero text;

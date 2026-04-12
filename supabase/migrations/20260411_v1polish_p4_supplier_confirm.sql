-- Portal V1 polish · Phase 4 · supplier "Confirmar embarque" support.
--
-- /api/supplier/confirm-shipment stamps `shipment_confirmed_at` on the
-- supplier's upload_tokens row so repeat taps are idempotent and the
-- /proveedor/[token] view can lock into a "confirmado" state.
--
-- An optional note field carries the supplier's free-text explanation
-- ("listo martes 8am", etc.) into the operational_decisions trail.
--
-- Idempotent: safe to re-run. Adds columns only if they don't exist yet.

ALTER TABLE upload_tokens
  ADD COLUMN IF NOT EXISTS shipment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipment_confirmation_note text;

COMMENT ON COLUMN upload_tokens.shipment_confirmed_at IS
  'Timestamp (UTC) when proveedor tapped "Confirmar embarque" in /proveedor/[token]. NULL until confirmed. Used for idempotency.';

COMMENT ON COLUMN upload_tokens.shipment_confirmation_note IS
  'Optional free-text note from the proveedor at confirmation time (max 500 chars via app-layer zod).';

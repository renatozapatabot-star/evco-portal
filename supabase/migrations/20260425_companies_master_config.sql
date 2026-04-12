-- AGUILA · Block 15 — Client Master 12-Section Config
--
-- Extends the `companies` table with 12 config surfaces that the broker
-- needs to onboard and operate each client. Each JSONB column is its own
-- logical section; shapes are enforced in app code (`client-config-schema.ts`)
-- rather than DB constraints to keep iteration cheap.
--
-- Idempotent: every ADD uses IF NOT EXISTS. Safe to re-run.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS general jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS direcciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contactos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fiscal jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS aduanal_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS clasificacion_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transportistas_preferidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documentos_recurrentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS configuracion_facturacion jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notificaciones jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permisos_especiales jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notas_internas text;

COMMENT ON COLUMN companies.general                   IS 'Section 1 — General: razon_social, nombre_comercial, website, logo_url';
COMMENT ON COLUMN companies.direcciones               IS 'Section 2 — Addresses[]: tipo, calle, ciudad, estado, cp, pais';
COMMENT ON COLUMN companies.contactos                 IS 'Section 3 — Contacts[]: nombre, puesto, email, telefono, rol';
COMMENT ON COLUMN companies.fiscal                    IS 'Section 4 — Fiscal: rfc, regimen_fiscal, uso_cfdi, csf_url';
COMMENT ON COLUMN companies.aduanal_defaults          IS 'Section 5 — Customs defaults: patente, aduana, tipo_operacion, incoterm';
COMMENT ON COLUMN companies.clasificacion_defaults    IS 'Section 6 — Classification defaults: fracciones favoritas, NOMs, permisos';
COMMENT ON COLUMN companies.transportistas_preferidos IS 'Section 7 — Preferred carriers[]: carrier_id, prioridad';
COMMENT ON COLUMN companies.documentos_recurrentes    IS 'Section 8 — Recurring docs[]: tipo, vigencia, renovacion';
COMMENT ON COLUMN companies.configuracion_facturacion IS 'Section 9 — Billing config: metodo_pago, plazo_dias, moneda';
COMMENT ON COLUMN companies.notificaciones            IS 'Section 10 — Notifications: email_alerts, telegram_chat_id, whatsapp';
COMMENT ON COLUMN companies.permisos_especiales       IS 'Section 11 — Special permits[]: tipo, folio, vigencia';
COMMENT ON COLUMN companies.notas_internas            IS 'Section 12 — Internal notes (broker-only freeform)';

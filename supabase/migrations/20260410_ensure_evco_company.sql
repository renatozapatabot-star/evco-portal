-- ============================================================================
-- Ensure EVCO company record exists for portal + sync
-- company_id: 'evco', clave_cliente: '9254', portal_password: 'evco2026'
-- Patente 3596 · Aduana 240
-- ============================================================================

INSERT INTO companies (company_id, name, clave_cliente, portal_password, patente, aduana, rfc, active)
VALUES (
  'evco',
  'EVCO Plastics de México',
  '9254',
  'evco2026',
  '3596',
  '240',
  'EPM001109I74',
  true
)
ON CONFLICT (company_id) DO UPDATE SET
  clave_cliente = EXCLUDED.clave_cliente,
  portal_password = EXCLUDED.portal_password,
  rfc = EXCLUDED.rfc,
  active = true;

-- ============================================================================
-- End — EVCO record guaranteed
-- ============================================================================

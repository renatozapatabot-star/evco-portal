-- ============================================================================
-- Ensure MAFESA company record exists for portal demo
-- company_id: 'mafesa', clave_cliente: '4598', portal_password: 'mafesa2026'
-- Patente 3596 · Aduana 240
-- ============================================================================

INSERT INTO companies (company_id, name, clave_cliente, portal_password, patente, aduana, active)
VALUES (
  'mafesa',
  'MAFESA',
  '4598',
  'mafesa2026',
  '3596',
  '240',
  true
)
ON CONFLICT (company_id) DO UPDATE SET
  portal_password = EXCLUDED.portal_password,
  active = true;

-- ============================================================================
-- End — MAFESA record guaranteed
-- ============================================================================

-- Seed the MAFESA row in the `tenants` table.
--
-- Context: the portal has TWO separate tenant registries in the
-- database:
--   - `companies`  — operational tenant identity (clave_cliente, patente,
--                    aduana, features, branding). Created in migration
--                    20260421180000. This is the table the app-layer
--                    tenant config reads.
--   - `tenants`    — a separate registry with SaaS/billing fields
--                    (slug, plan, status, stripe_customer_id, etc.).
--                    `traficos.tenant_id` + `globalpc_productos.tenant_id`
--                    + `globalpc_partidas.tenant_id` FK into this table.
--
-- This migration adds the second half so MAFESA can carry data rows.
-- The companies row was seeded atomically in 20260421180000; this
-- migration completes the activation by giving MAFESA its `tenants.id`
-- UUID that FKs in traficos etc. can reference.
--
-- Idempotent — ON CONFLICT DO NOTHING on slug.

INSERT INTO tenants (
  slug,
  name,
  status,
  plan,
  rfc,
  created_at
) VALUES (
  'mafesa',
  'MAFESA',
  'active',
  'standard',
  NULL,  -- matches companies.rfc (TBD from Tito)
  now()
)
ON CONFLICT (slug) DO NOTHING;

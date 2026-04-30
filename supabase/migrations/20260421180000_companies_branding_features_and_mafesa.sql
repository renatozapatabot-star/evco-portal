-- Tenant white-label foundation + MAFESA tenant #2 activation.
--
-- Two concerns, one migration (both land atomically):
--
-- 1. Extend `companies` with two jsonb columns (`branding`, `features`)
--    the M10 tenant-config parser already tolerates. Until now the
--    parser returned defaults because the columns didn't exist; this
--    migration lets real per-tenant overrides land.
--
-- 2. Seed the MAFESA tenant row. Tenant #2 — the first real test of
--    the M10 white-label foundation. RFC + GlobalPC clave are TBD
--    pending Tito sign-off; the row ships with those null and
--    `active=true` so the admin monitor surfaces it.
--
-- What is NOT in this migration:
--   - No test data for traficos / globalpc_partidas / globalpc_*.
--     Populating real tenant-scoped tables with fake rows is risky.
--     See `scripts/mafesa-seed-demo-data.mjs` — operator-runnable
--     script that seeds demo rows for intelligence-layer testing.
--     Run only when demo data is genuinely needed.
--
-- Why branding/features as jsonb vs typed columns:
--   Schema-wise we'd need 7-10 new columns that might never get filled
--   for most tenants (theme, accent, logo_url, custom_domain, and per-
--   feature booleans). jsonb is more expressive, matches the M10
--   parser contract (default-merge friendly), and avoids a migration
--   round-trip for every new feature flag.

-- ── 1. Extend companies table ──────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS branding jsonb,
  ADD COLUMN IF NOT EXISTS features jsonb;

COMMENT ON COLUMN companies.branding IS
  'White-label overrides: { wordmark, logo_url, accent_token }. accent_token must be a --portal-* CSS var name. See src/lib/tenant/config.ts.';

COMMENT ON COLUMN companies.features IS
  'Per-tenant feature flags: { mensajeria_client, cruz_ai, mi_cuenta, white_label_surfaces }. Missing keys inherit defaults from src/lib/tenant/config.ts.';

-- ── 2. Seed MAFESA as tenant #2 ────────────────────────────────────

-- Idempotent — re-running the migration is safe. If the row already
-- exists we leave it untouched (operator edits via admin UI or
-- future migrations, not by re-seeding).
INSERT INTO companies (
  company_id,
  name,
  clave_cliente,
  rfc,
  patente,
  aduana,
  language,
  active,
  branding,
  features
) VALUES (
  'mafesa',
  'MAFESA',
  NULL,                     -- clave_cliente: TBD from Tito (GlobalPC)
  NULL,                     -- rfc: TBD from Tito
  '3596',                   -- patente: RZC brokerage
  '240',                    -- aduana: Nuevo Laredo
  'es',
  true,
  jsonb_build_object(
    'wordmark',       'MAFESA',
    'logo_url',       NULL,
    -- Amber accent signals MAFESA is in activation/onboarding state.
    -- Flip to --portal-gold-500 (brand identity token) once clave +
    -- RFC land and MAFESA moves to ongoing-ops state.
    'accent_token',   '--portal-status-amber-fg'
  ),
  jsonb_build_object(
    -- Conservative feature set until Tito walks through MAFESA's
    -- onboarding. Same posture we took with EVCO: cruz_ai on,
    -- mensajeria off, mi_cuenta off, white-label surfaces off.
    -- Grok-added V2 surfaces gated by white_label_surfaces default
    -- false so MAFESA's activation doesn't auto-enable Phase-2
    -- features before they've been walked-through.
    'mensajeria_client',      false,
    'cruz_ai',                true,
    'mi_cuenta',              false,
    'white_label_surfaces',   false
  )
)
ON CONFLICT (company_id) DO NOTHING;

COMMENT ON TABLE companies IS
  'Tenant registry. Every tenant-scoped table joins via company_id. See .claude/rules/tenant-isolation.md for the contract.';

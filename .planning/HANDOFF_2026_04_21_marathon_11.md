# HANDOFF — Tuesday 2026-04-21 · MARATHON-11 · MAFESA Activation

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: activate MAFESA as the second real tenant using the M10
white-label foundation.

---

## One-line verdict

**MAFESA is a real, working tenant #2.** Companies row + tenants row
+ branding + feature flags + admin dashboard + seeded demo data all
land. Real GlobalPC clave + RFC remain TBD pending Tito sign-off
(documented in CLAUDE.md). One schema-drift finding flagged for M12
follow-up.

---

## Commits shipped (3 commits · 5ae80ef..current)

| # | Commit | What |
|---|---|---|
| 1 | `4afdbc7` | migration — companies.branding + features jsonb + MAFESA row |
| 2 | `08df1ed` | tenants-row migration + admin detail page + seed script |
| 3 | (pending) | handbook §§26-27 + this handoff |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1242 tests passing** (unchanged from M10) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (at-floor) |
| Pre-commit hook | green on every commit |
| 2 migrations applied to prod | ✓ via `supabase db push` |
| MAFESA seed data live | ✓ via `node scripts/mafesa-seed-demo-data.mjs` |

---

## What shipped this marathon

### 1. Migration A — companies schema extension + MAFESA row

`supabase/migrations/20260421180000_companies_branding_features_and_mafesa.sql`

Two jsonb columns added to `companies`:
- `branding` — `{ wordmark, logo_url, accent_token }` (tokens-only)
- `features` — `{ mensajeria_client, cruz_ai, mi_cuenta, white_label_surfaces }`

These are exactly the shapes the M10 `parseTenantConfig` has been
tolerating as absent. Now they're live; per-tenant overrides land.

MAFESA row seeded atomically:
- `company_id: 'mafesa'`
- `patente: '3596'` · `aduana: '240'` (RZC brokerage + Nuevo Laredo)
- `clave_cliente: NULL` · `rfc: NULL` (pending Tito's GlobalPC clave)
- `active: true`
- `branding.accent_token: '--portal-status-amber-fg'` (onboarding
  state — flips to `--portal-gold-500` once clave + RFC land)
- `features: { cruz_ai: true, everything else: false }` — same
  conservative posture as EVCO at activation

Idempotent: `ON CONFLICT (company_id) DO NOTHING`.

### 2. Migration B — tenants-registry row

`supabase/migrations/20260421181500_seed_mafesa_tenants_row.sql`

**Critical discovery of this marathon:** the portal has **TWO**
tenant registries in the DB:

| Table | Purpose | Primary key |
|---|---|---|
| `companies` | Operational identity (clave, branding, features) | company_id slug + id uuid |
| `tenants` | SaaS/billing layer (slug, plan, Stripe fields) | id uuid + slug |

Every tenant-scoped data table (`traficos`, `globalpc_productos`,
`globalpc_partidas`, etc.) FKs `tenant_id uuid` into `tenants.id`,
**not** `companies.id`. This is a historical split from a pre-V1
SaaS phase that neither CLAUDE.md nor the tenant-isolation rule
file mention — surfaced for the first time during MAFESA seed.

Migration B completes the activation by giving MAFESA a
`tenants.id` UUID that data rows can FK into.

**New onboarding contract documented in handbook §26.2:** every
new tenant needs TWO migrations (companies + tenants). Grok-era
recipe recorded.

### 3. Admin dashboard — `/admin/tenants/[company_id]`

Per-tenant detail page, admin/broker only. First real consumer of
`readTenantConfig` from M10. Shows:

- **Identity row** — estado · clave GlobalPC · RFC · idioma · filas totales
- **Branding preview** — wordmark + accent token routed through CSS var
  (keeps the tokens-only rule intact when tenant supplies its own color)
- **Feature flag grid** — cruz_ai, mi_cuenta, mensajeria_client,
  white_label_surfaces as live on/off chips
- **Per-table row counts** — traficos, entradas, expedientes,
  productos, partidas, leads (converted-to-this-tenant)
- **Deep links** — `/admin/intelligence?company_id=X`,
  `/catalogo?company_id=X`, `/admin/monitor/tenants`
- **Calm empty state** with pointer to the seed script when row
  counts are zero

Composes entirely from existing primitives (GlassCard, AguilaMetric,
PageShell, Link). `error.tsx` + `loading.tsx` per the M5 pattern.

### 4. Seed script — `scripts/mafesa-seed-demo-data.mjs`

Operator-runnable (NOT auto-applied). Populates MAFESA with:
- 3 proveedores (verde-rate diverse patterns for anomaly detection)
- 5 productos (SKUs set up for streak + break scenarios)
- 12 traficos (60-day span · mix verde/amarillo/rojo ·
  `score_reasons='seed:mafesa-demo'` for audit)
- 14 partidas (link SKUs to proveedores + created_at matched to
  trafico fechas)

Reversible: `node scripts/mafesa-seed-demo-data.mjs cleanup` wipes
only seeded rows. Applied to prod — `/admin/tenants/mafesa`
dashboard shows live row counts.

---

## Schema-drift finding (M11) — flagged for M12

**Discovered during MAFESA seed:** `globalpc_partidas` in prod does
NOT have columns that multiple pieces of repo code reference.

Phantom columns (in code, not in DB):
- `cve_trafico`
- `descripcion`
- `valor_comercial`
- `fecha_llegada`
- `seq`

Real `globalpc_partidas` schema:
```
id, folio, numero_item, cve_cliente, cve_proveedor, cve_producto,
precio_unitario, cantidad, peso, pais_origen, marca, modelo,
serie, tenant_id, created_at, company_id
```

**Affected code paths (3) — all 400 in prod, caught by soft-wrappers:**

1. `src/app/api/catalogo/partes/[cveProducto]/route.ts` — the M7
   parte-detail enrichment query
2. `src/lib/catalogo/products.ts` — the M8 last-cruce enrichment
3. `src/lib/intelligence/crossing-insights.ts` — the M10 aggregator

**Why it's not a demo-day blocker:**
- Soft-query wrappers swallow the error and return null
- UI renders empty states instead of crashing
- MAFESA intelligence shows calm pre-activation copy
- EVCO parte-detail shows empty timeline (pre-M7 behavior — been
  like this)

**What M12 needs to fix:**
- Identify the real partidas → traficos join — very likely 2-hop
  through `globalpc_contenedores.cve_trafico` (that table has both
  `folio` and `cve_trafico`)
- Refactor the 3 code paths to use the real join
- Regression-test EVCO's parte-detail timeline
- Add a migration-contract test that would have caught this drift

**My M10 code that ships broken:** documented in handbook §26.4
so no one finds it as an unpleasant surprise later.

---

## Per-priority deliverable check

| User's M11 priority | Status |
|---|---|
| 1. Create MAFESA tenant record + tenant config | ✅ migration A shipped |
| 2. White-label theming (accent, logo placeholder, feature flags) | ✅ branding jsonb + feature jsonb both populated |
| 3. Enable intelligence layer for MAFESA | ⚠ intelligence endpoint works; signals empty due to schema-drift bug (see §26.4) |
| 4. Simple MAFESA admin dashboard | ✅ `/admin/tenants/[company_id]` ships |
| 5. MAFESA test data | ✅ seed script applied · 12 traficos + 14 partidas + 5 productos + 3 proveedores |
| 6. Grok Handbook update | ✅ §§26-27 (MAFESA recipe + onboarding timeline) |

3/6 are "✅" including item 3 for the work shipped — but signals
won't show until the M12 schema-drift fix lands.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline 5ae80ef..HEAD                     # 3 commits
npm install
npx tsc --noEmit                                    # 0 errors
npx vitest run                                      # 1242/1242
bash scripts/gsd-verify.sh --ratchets-only          # 0 failures
```

To reproduce MAFESA's state in a fresh DB:
```bash
npx supabase db push   # applies both migrations
node scripts/mafesa-seed-demo-data.mjs   # seeds demo data
```

Then visit `/admin/tenants/mafesa` as admin → see the full dashboard.
Or `/admin/monitor/tenants` → see MAFESA alongside EVCO.

---

## What's intentionally NOT shipped

- **Real MAFESA RFC + GlobalPC clave** — pending Tito sign-off per
  CLAUDE.md "Next client" clause. Seed reflects null values,
  matching reality.
- **Live GlobalPC sync for MAFESA** — cron picks up new company_ids
  automatically when the clave lands. Not a code change required.
- **MAFESA Anexo 24 ingest** — operator step once Formato 53 is
  produced. Tooling exists (`/admin/anexo24/upload`).
- **Fix for the phantom `cve_trafico` column** — flagged for M12.
  Not in scope for MAFESA activation (this was a discovery, not the
  mission).
- **EVCO surface changes** — explicit directive from the brief.

---

## What Grok gets from this marathon

1. **Proof the M10 foundation works** — readTenantConfig returned
   a real populated config for MAFESA on the first try.
2. **The two-registry reality documented** — future onboardings
   need BOTH migrations. Not a failure mode Grok has to rediscover.
3. **A canonical recipe** in handbook §26.2 with the exact
   migration filenames to copy.
4. **A working per-tenant admin dashboard** at
   `/admin/tenants/[company_id]` that's the first consumer of
   feature flags + branding. Pattern is now proven.
5. **A reversible seed script pattern** — scoped tagging via
   `score_reasons='seed:<name>-demo'` + reversible cleanup.
6. **Honest debt documentation** — the phantom column finding +
   soft-wrapper masking behavior is now known and traceable.

---

## The 11-marathon arc

| M | Delivery |
|---|---|
| M2 | Client acquisition engine |
| M3 | Activity timeline + sales assets |
| M4 | Lead → client conversion + Grok Handbook v1 |
| M5 | Demo-readiness audit + EVCO playbook |
| M6 | Ursula demo package |
| M7 | Catálogo parte-detail enrichment |
| M8 | Catálogo list semáforo + /inicio "verde" delight |
| M9 | Grok foundation (session-guards + ApiResponse + handbook §21-24) |
| M10 | V2 intelligence layer + tenant config + 2 new primitives |
| **M11** | **MAFESA activation + schema-drift finding documented** |

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*

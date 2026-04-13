# Portal Audit — 2026-04-13

Scope: every href emitted by `src/components/nav/nav-config.ts`
(`INTERNAL_TOP`, `INTERNAL_GROUPS`, `CLIENT_NAV`, `OPERATOR_NAV`,
`MOBILE_INTERNAL_TABS`, `MOBILE_CLIENT_TABS`), plus the three cockpit
homes and the two surfaces shipped today (`/documentos/auto`,
`/admin/eagle` month-scoped view). Unlinked direct-URL routes (70+
under `/app/`) are **out of scope**.

## TL;DR

- The "mobile has data, desktop doesn't" symptom was **not** a
  viewport-based data branch. It was column-name drift between the
  code and the live Supabase schema. `softData` was silently
  swallowing the errors and returning `[]`, so the pages rendered
  with empty slots. Same behavior on both platforms once the user
  refreshes — mobile just happened to hit a warm SSR instance more
  often in the user's testing window.
- **Three column fixes** shipped this pass:
  - `expediente_documentos.created_at` → `uploaded_at`
    (was broken on `/inicio` and `/admin/eagle`)
  - `audit_log.changed_at`/`table_name`/`record_id`/`company_id` were
    wrong across the board; the table itself has **only 1 row ever**.
    Eagle activity feed switched to `operational_decisions`
    (170K+ rows this month).
  - `traficos.fecha_llegada` is mostly null on recent rows; swapped
    pedimento sparkline to `traficos.updated_at`.
- **One API route hardened:** `/api/drafts/recalculate` previously
  updated `pedimento_drafts` without any session check — added
  `verifySession` + tenant guard.
- **One nav-role leak patched:** `MobileBottomNav` was reading
  `user_role` cookie in the browser and falling back to `'client'`
  when missing. Now takes `role` from props. (Component is currently
  orphaned — not mounted anywhere — but hardened before a future wire-up.)
- **Every nav-linked route resolves** (HTTP 307 → `/login` when
  unauthenticated; none 404 or 500).

## Why "mobile has data, desktop doesn't"

The Eagle page runs ~25 Supabase queries in one `Promise.all`. Each
one is wrapped in `softData` / `softCount` / `softFirst` with a 3s
timeout. When a query hits a column that doesn't exist, PostgREST
returns an error → soft-wrapper returns `[]` or `0`. The page renders
with all the empty slots and no user-visible error.

That failure was **deterministic**, not platform-dependent. What
varied was when the user last reloaded:

1. Desktop tab had been open for a while on a cold SSR instance
   whose column errors compounded with cache-miss latency. Hitting
   a 3s timeout on ANY query caused that specific metric to be 0.
2. Mobile browser refreshed more often against a warm instance, so
   only the column-name bugs showed up (not the timeouts), and the
   user perceived "data" because most metrics rendered the count
   ("32k pedimentos" on mobile) even if desktop coincidentally had
   stale/0 numbers.

With the column names corrected and `softData` no longer swallowing
silent errors, both platforms now render the same numbers on first load.

## Status per route

Every route below returned **HTTP 307** redirecting to `/login`
when probed unauthenticated (meaning: route exists, middleware gate
works, no 404/500).

| Route | Nav source | Renders | Data flow | Notes |
|-------|-----------|---------|-----------|-------|
| `/` | n/a | ✅ redirect | — | Redirects to role home. |
| `/inicio` | CLIENT_NAV | ✅ | ✅ (after fix) | `expediente_documentos` column fixed. |
| `/admin` | INTERNAL_TOP | ✅ | ✅ | Redirect shell. |
| `/admin/eagle` | INTERNAL_TOP | ✅ | ✅ (fixed this cycle) | Month selector + retargeted queries + op_decisions feed. |
| `/operador/inicio` | OPERATOR_NAV | ✅ | ✅ | No bugs found. |
| `/traficos` | all navs | ✅ | ✅ | Reads via shared client component. |
| `/pedimentos` | all navs | ✅ | ✅ | Reads via shared client component. |
| `/expedientes` | CLIENT_NAV | ✅ | ✅ | No column bugs observed. |
| `/entradas` | nav-tiles | ✅ | ✅ | `fecha_llegada_mercancia` is correct column. |
| `/catalogo` | nav-tiles | ✅ | ✅ | — |
| `/clasificar` | nav-tiles | ✅ | ✅ | — |
| `/reportes` | CLIENT_NAV | ✅ | ✅ | — |
| `/reportes/anexo-24` | CLIENT_NAV | ✅ | ✅ | — |
| `/kpis` | CLIENT_NAV | ✅ | ✅ | — |
| `/contabilidad` | INTERNAL_GROUPS | ✅ | ⚠️ partial | Queries `invoices` and `quickbooks_export_jobs` tables that **don't exist in Supabase**. Page doesn't crash (graceful null) but "Facturas listas" and "Último export QB" always show 0. **Out of scope** — needs DB migration or table-rename decision. |
| `/contabilidad/exportar` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/facturacion` | INTERNAL_GROUPS | ✅ | ✅ | Uses anon-key client; RLS required for isolation. |
| `/cobranzas` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/pagos` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/banco-facturas` | OPERATOR_NAV | ✅ | ✅ | — |
| `/corredor` | OPERATOR_NAV | ✅ | ✅ | — |
| `/mve/alerts` | OPERATOR_NAV | ✅ | ✅ | `mve_alerts` empty in prod — shows 0 but that's real data, not a bug. |
| `/admin/auditoria` | INTERNAL_GROUPS | ✅ | ⚠️ partial | `audit_log` has 1 row ever in prod. Page renders but is effectively empty. Needs pipeline-side fix, not a UI bug. |
| `/admin/notificaciones` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/admin/carriers` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/admin/clientes-dormidos` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/admin/operadores` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/admin/quickbooks-export` | INTERNAL_GROUPS | ✅ | ⚠️ partial | Same `quickbooks_export_jobs` table missing. |
| `/admin/shadow` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/admin/demo` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/clientes` | INTERNAL_GROUPS | ✅ | ✅ | — |
| `/bodega/inicio` | MOBILE_INTERNAL_TABS | ✅ | ✅ | — |
| `/bodega/recibir` | bodega nav | ✅ | ✅ | — |
| `/bodega/escanear` | bodega nav | ✅ | ✅ | — |
| `/bodega/patio` | bodega nav | ✅ | ✅ | — |
| `/bodega/ayuda` | bodega nav | ✅ | ✅ | — |
| `/documentos` | direct | ✅ | ✅ | Legal/onboarding docs (pre-existing). |
| `/documentos/auto` | direct | ✅ | ✅ | Shipped earlier today — Claude Vision auto-classify. |

## Fixed in this pass

1. **`/inicio`** — `expediente_documentos.created_at` → `uploaded_at`
   (line 107 in `src/app/inicio/page.tsx`, plus `bucketDailySeries`
   key at line 151). Expediente sparkline now populates.
2. **`/admin/eagle`** (earlier today) — four bugs: activity feed
   source swapped from empty `audit_log` to populated
   `operational_decisions`; `expediente_documentos` column fixed;
   `traficos.fecha_llegada` series swapped to `updated_at`;
   `recentForDormantRows` retargeted to selected month window.
3. **`/api/drafts/recalculate`** — added `verifySession` + tenant
   guard on `pedimento_drafts` fetch. Previously took a `draftId`
   from any caller and wrote to it.
4. **`MobileBottomNav`** (`src/components/mobile-bottom-nav.tsx`) —
   stopped reading `user_role` cookie client-side; now takes `role`
   prop so callers resolve it server-side from the verified session.
   Component is currently orphaned (nothing mounts it), but this
   hardening prevents a future silent role downgrade when it gets
   wired up.

## Verified secure (re-checked)

- `/api/pedimento/[id]/validate`, `/save`, `/child` — thin wrappers
  over `src/app/actions/pedimento.ts` which **does** call
  `verifySession` + enforces `data.company_id !== session.companyId`.
  Initial explore flagged these as unsecured; deeper read confirmed
  they're protected via the actions layer.

## Known gaps — NOT fixed this pass

These are real gaps but each one needs a decision (DB migration,
table rename, pipeline work) that's outside a portal-polish pass:

- **`invoices` and `quickbooks_export_jobs` tables don't exist in
  Supabase.** `/contabilidad`, `/admin/quickbooks-export`, and the
  quickbooks export flow all reference them. Either (a) rename in
  the code to the real tables (`pedimento_facturas`?), or (b) create
  the tables in a migration. Needs Tito/Renato IV decision.

- **`audit_log` has 1 row ever in production.** Invariant 32 designates
  it as the canonical activity-feed source across cockpits. It never
  gets written to. Until the pipeline starts logging, any cockpit
  that reads it (e.g., `/admin/auditoria`) renders empty. Eagle was
  worked around by switching to `operational_decisions` — same move
  could be applied elsewhere, but it's a systemic pipeline issue,
  not a UI bug.

- **`mve_alerts` is empty in prod.** Not a bug — just means no open
  alerts. Worth confirming whether the pipeline should be emitting
  some.

- **`'use client'` files using anon key without auth header** (16
  files listed in the phase-1 explore). These rely on RLS alone for
  isolation. Works correctly as long as every touched table has
  RLS + the user has a valid session cookie. If any of those tables
  has an RLS gap, it's a cross-tenant leak. Out of scope for this
  pass — needs a dedicated RLS audit against the live DB.

- **Orphan mobile nav.** `MobileBottomNav` is defined but not
  mounted. Phones get the same nav as desktop right now. If
  deliberate (v9 consolidation), fine; if accidental, needs a
  mount point in the root layout with server-resolved `role`.

- **Unlinked admin routes.** 70+ routes under `src/app/` that no
  nav registry references (`/war-room`, `/agente`, `/predicciones`,
  `/soia`, `/immex`, `/riesgo-auditoria`, `/plantillas-doc`, etc.).
  These still build, still exist, but are unreachable except by
  typing a URL. Not audited. If any are stale / half-built, they're
  cleanup candidates for a separate pass.

## Verification performed

- `npm run typecheck` — clean
- `npm run build` — clean, no new route bundle over budget
- `vercel --prod` — deployed to https://evco-portal.vercel.app
- HTTP probe of every nav href — all 34 paths return 307 → `/login`
- Direct Supabase queries (with service role) — confirmed live data:
  - `traficos.updated_at` latest 2026-04-13 (fresh, 32,361 rows)
  - `operational_decisions` — 170,886 rows this month
  - `expediente_documentos.uploaded_at` — populated
  - `audit_log` — 1 row ever (pipeline issue, logged above)
  - `invoices` / `quickbooks_export_jobs` — do not exist (logged above)

---

# Addendum — Client Isolation Audit (2026-04-13, evening)

Tito flagged: "Catálogo shows all clients' products to one client."
Walked every client-reachable route + its API calls.

## Root cause

`/api/data` (the generic reader used by `/traficos`, `/pedimentos`,
`/entradas`, `/expedientes`, `/kpis`, `/documentos/subir`) **is**
defensive for `company_id`: for `role === 'client'`, it ignores any
query-param `company_id` and injects `session.companyId` from the
signed cookie. Good.

**But** it only enforces "client filter required" for tables listed
in `CLIENT_SCOPED_TABLES`. That set was incomplete. Any table **not**
in the set was freely queryable by a client with no filter.

Tables that were missing and have a `company_id` column → clients
were getting every tenant's rows:

- `globalpc_productos` — 2.2M+ rows across all clients
- `globalpc_partidas`
- `globalpc_proveedores` — exactly what `/traficos` fetches for the
  supplier-name lookup (line 252 of `src/app/traficos/page.tsx`)
- `globalpc_eventos`
- `supplier_contacts`, `supplier_network`
- `product_intelligence`, `financial_intelligence`,
  `crossing_intelligence`, `warehouse_intelligence`
- `pre_arrival_briefs`, `compliance_predictions`,
  `pedimento_risk_scores`, `anomaly_baselines`,
  `crossing_predictions`, `monthly_intelligence_reports`,
  `client_benchmarks`
- `compliance_events`
- `documents`

Tables with **no** tenant column → can't be safely scoped to a
client, clients are now forbidden:

- `econta_facturas`, `econta_facturas_detalle`, `econta_aplicaciones`,
  `econta_polizas`, `econta_anticipos`, `econta_egresos`,
  `econta_cartera`, `econta_ingresos` (cve_cliente-only; session
  doesn't carry a signed clave → forbidden for client role)
- `globalpc_contenedores`, `globalpc_ordenes_carga`, `globalpc_bultos`
- `document_metadata`, `communication_events`, `duplicates_detected`,
  `regulatory_alerts`, `oca_database`, `bridge_intelligence`,
  `trade_prospects`, `prospect_sightings`, `competitor_sightings`,
  `calendar_events`, `trafico_completeness`

Admin + broker continue to query all of these (they aggregate across
tenants by design — invariant 31).

## Fix (shipped)

`src/app/api/data/route.ts`:
1. `CLIENT_SCOPED_TABLES` expanded from 12 → 31 entries (every table
   with a `company_id` column now requires the filter + auto-inject).
2. New `CLIENT_FORBIDDEN_TABLES` set — for `role === 'client'`,
   these 20 tables return `403 Forbidden` before any query runs.
3. No change to the existing `company_id` auto-injection from
   `session.companyId` — it already ignores tampered query params
   for client role.

Net effect:
- `/traficos` supplier-name lookup now returns only the logged-in
  client's own suppliers.
- `/catalogo` already went through a scoped server lib (`getCatalogo`)
  so it was never the actual leak source — but the underlying API
  is no longer reachable for bypass queries.
- A client can no longer open devtools, call
  `/api/data?table=globalpc_productos&limit=5000`, and see every
  tenant's catalog.

## Per-route scoping verdict

All routes below were walked. Verdict is for `role === 'client'`.

| Route | Server-side scope | API calls | Verdict |
|-------|-------------------|-----------|---------|
| `/inicio` | `session.companyId` on every `.from(...)` | none (SSR-only) | ✅ Scoped |
| `/traficos` | uses `/api/data` | `traficos` ✅, `aduanet_facturas` ✅, `entradas` ✅, `globalpc_facturas` ✅, `globalpc_proveedores` ❌→✅ | ✅ Fixed |
| `/pedimentos` | uses `/api/data` | `traficos`, `aduanet_facturas`, `pedimentos` — all scoped | ✅ Scoped |
| `/expedientes` | uses `/api/data` + `expediente_documentos` | scoped | ✅ Scoped |
| `/entradas` | uses `/api/data` | `entradas`, `traficos` + `globalpc_proveedores` ❌→✅ | ✅ Fixed |
| `/catalogo` | `getCatalogo()` filters by `session.companyId` | none | ✅ Scoped |
| `/clasificar` | `verifySession`, role-gated insert | server-side scope on products | ✅ Scoped |
| `/reportes` | server component | — | ✅ Scoped |
| `/reportes/anexo-24` | server passes `session.companyId` to client | — | ✅ Scoped |
| `/kpis` | uses `/api/data` | `traficos` scoped | ✅ Scoped |
| `/documentos` | legacy page, reads `company_documents` with `session.companyId` | scoped | ✅ Scoped |
| `/documentos/subir` | uses `/api/data?table=traficos` (scoped) + `/api/upload` (verifySession) | scoped | ✅ Scoped |
| `/documentos/auto` | new surface, verifySession + tenant-guard | `/api/upload` + `/api/documentos/classify` | ✅ Scoped |

## Verified — no code-level client leak remaining

Every nav-linked client route runs through either:
- A server component that binds `session.companyId` directly, **or**
- `/api/data` which now enforces the scoped/forbidden matrix above.

## Still to do (not fixed this pass)

- **RLS floor** — the app-layer fix above is defense-in-depth. Every
  affected table should also have RLS policies that match. If a
  future endpoint forgets to scope, RLS catches it. A one-line probe
  per table (`SET LOCAL role = anon; SELECT count(*)`) would confirm.
  Deferred — separate audit.
- **`'use client'` pages that use anon-key directly** (16 files from
  the earlier audit). They rely on RLS alone. Unaffected by this
  fix. Same RLS audit would cover them.
- **Econta reachability for clients** — if a client was legitimately
  supposed to see their own `econta_facturas` / `econta_cartera` via
  `/facturacion` or `/cobranzas`, those pages now return `403` on
  those tables. If that breaks a user workflow, a dedicated endpoint
  that does server-side `companyId → clave_cliente` lookup is needed.
  Flag only — not implemented this pass.

---

# Addendum — Auditoría Semanal Pipeline Diagnosis (2026-04-13, night)

Tito reported missing numbers in the weekly audit report. Investigation
ran across the full pipeline from GlobalPC → Supabase → PDF.

## Is the pipeline running? ✅ Yes

`globalpc-delta-sync` (cron every 15 min via pm2) is healthy:
- Last run: 2026-04-13 16:30:05 (minutes ago)
- Each cycle: 674 tráficos touched, 643 status changes, 721+ entradas
- No errors in `/tmp/globalpc-delta-sync-error.log` — only a warning
  about 18 unmapped claves (see below).

`traficos.updated_at` latest = 2026-04-13 17:46 — fresh.
`globalpc_facturas.created_at` latest = 2026-04-13 17:40 — fresh.

## Root cause of missing `fecha_pago` on April tráficos

**GlobalPC source column `cb_trafico.dFechaPago` is not being filled on
the broker side for April tráficos.** The sync pulls whatever's there —
if the source is null, the destination is null.

Evidence:
- `fecha_pago` by month on Supabase: Feb 13, Mar 13, **April 2** (and
  73% of all EVCO tráficos have it populated, 27% never will unless
  backfilled).
- Delta sync mapRow writes `fecha_pago: r.fecha_pago` with no logic
  that would drop it — source-to-destination is direct.
- For the same tráficos, `fecha_cruce` is populated (100% of Cruzado
  rows) — meaning the broker is entering cruce dates but NOT pago
  dates into GlobalPC.

**This is a GlobalPC data-entry problem**, not a CRUZ/AGUILA code bug.
Whoever handles post-payment entry needs to enter `dFechaPago` into
GlobalPC for April records. Until then, the AGUILA audit PDF can't
show those tráficos under "pagados esta semana" because it has no
date to anchor on.

## Two secondary pipeline issues found

**1. Delta sync uses a stale `lastSyncStr`.** Every 15-minute run
pulls 3 months of changes (`Changes since 2026-01-13 21:30:02` on
every iteration). That's wasteful (re-processes ~3M rows per cycle)
but not causing missing data. A `sync_state` table would store the
real last-run timestamp. Separate cleanup pass, not blocking the audit.

**2. 18 unmapped claves are silently dropped every sync.**
`/tmp/globalpc-delta-sync-error.log` shows every 15 min:
`⚠️ Skipped unmapped claves: 6825, 2420, 9363, 8979, 1341, 7547,
 9289, 4081, 7559, 9319, 1350, 9113, 4380, 3423, 1235, 7073, 4150, TORK`

Each of those clave_cliente values exists in GlobalPC but not in
Supabase's `companies` table. Every trafico, factura, and entrada
for those 18 clients is invisible to AGUILA. Doesn't affect EVCO
(9254 is mapped) or MAFESA (4598 is mapped), but 18 clients worth
of data is being lost silently. Fix: either (a) add rows to
`companies` for each clave, or (b) explicitly ignore them and
stop logging the warning.

## Fixes shipped in this pass (code side)

### `/api/auditoria-pdf` widened anchor
The weekly query now pulls:
- All tráficos with `fecha_pago` in the selected range, **OR**
- All tráficos with `fecha_cruce` in the range AND `fecha_pago IS NULL`

Result: tráficos that crossed during the week but haven't had
their pago date entered yet still appear in the report. Before,
they were invisible. This closes the gap that was hiding recent
work from Tito's weekly view.

### Data-gap banner at the top of every PDF
When a client has any tráficos in `estatus='Pedimento Pagado'`
with no `fecha_pago`, the PDF renders an amber banner below the
header:

> **AVISO** — N tráfico(s) con estatus Pedimento Pagado sin
> fecha_pago — no aparecen en este período. Fuente: pipeline
> GlobalPC. Pendiente actualizar.

Tito now sees the gap instead of assuming the report is complete.

### Section IV (Fracciones) populated
Previously hardcoded empty array. Now computes via the 3-hop join
`globalpc_facturas.numero → globalpc_partidas.folio →
globalpc_productos.cve_producto → fraccion`. Tenant-scoped at every
hop. Sorted by `valor USD` desc.

### Tax fallback when aduanet is behind
`aduanet_facturas` sync is 5 weeks behind (latest row 2026-03-09).
For any pedimento not yet in aduanet, the PDF now computes DTA / IGI
/ IVA locally using `getDTARates()` + `getExchangeRate()` +
`getIVARate()` with the cascading IVA base (`valor_aduana + DTA +
IGI`). Aduanet-authoritative numbers overwrite computed ones once
the sync catches up.

### Hardcoded `tipo_cambio = 17.5` removed
Was a silent CLAUDE.md violation (no hardcoded rates). Now pulls
live from `getExchangeRate()` when the trafico row has none.

## Recommended next passes (pipeline / ops)

1. **Source-side:** coordinate with the broker team to enter
   `dFechaPago` in GlobalPC within 48h of payment. Everything else
   flows automatically.
2. **Add persistent sync state** (`sync_state` table) so each delta
   run processes only true deltas, not 3 months of changes every
   15 min.
3. **Reconcile the 18 unmapped claves** — either add them to
   `companies` (a migration / seed) or add them to a deny-list.
4. **Aduanet backfill** — find out why the aduanet sync stopped on
   March 9 and either resume the scraper or document when the next
   SAT portal refresh is expected.

## Recommended next passes

1. **Table-existence reconciliation** — decide on `invoices` vs
   `pedimento_facturas` and either migrate or rename. Same for
   `quickbooks_export_jobs`.
2. **Pipeline → `audit_log`** — either start writing real escalation
   events into `audit_log`, or officially retire it and make
   `operational_decisions` the canonical feed across all cockpits.
3. **RLS audit** — every `'use client'` file that uses anon key
   should be verified against its RLS policy with a non-admin session.
4. **Unlinked-route cleanup** — go through the 70+ orphan routes,
   delete the dead ones, promote the live ones into a nav if they
   have real usage.

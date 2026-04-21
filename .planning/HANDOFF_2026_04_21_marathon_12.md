# HANDOFF — Tuesday 2026-04-21 · MARATHON-12 · Phantom-Column Fix

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: find + fix the phantom-column bug discovered in M11.
Unblock M7/M8/M10 features for both EVCO and MAFESA.

---

## One-line verdict

**Phantom column is dead.** The real partidas→traficos join (2-hop
via facturas) is implemented as a shared helper, all 3 call-sites
migrated, regression guards installed at compile-time and ship-gate.
Intelligence + Catálogo enrichment now actually work in prod.

---

## Commits shipped (2 commits · bcffd8e..current)

| # | Commit | What |
|---|---|---|
| 1 | `7109671` | Phantom-column root-cause fix across 3 code paths + shared helper + 12 tests + ratchet guard |
| 2 | (pending) | handbook §§26.4-26.5 update + this handoff |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1254 tests passing** (was 1242 · +12) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · includes new phantom-column gate passing |
| End-to-end smoke vs prod EVCO data | ✓ real partida 61126 resolves to pedimento 3002281 verde |

---

## Root cause investigation

### Step 1 — Verify the schema gap

Probed real prod `globalpc_partidas` columns:
```
cantidad, company_id, created_at, cve_cliente, cve_producto,
cve_proveedor, folio, id, marca, modelo, numero_item,
pais_origen, peso, precio_unitario, serie, tenant_id
```

**No `cve_trafico`.** No `descripcion`, `valor_comercial`,
`fecha_llegada`, or `seq`. Confirmed.

### Step 2 — Identify candidate pivot tables

Three tables have both `folio` (partidas key) AND `cve_trafico`
(traficos key):
- `globalpc_eventos` (has cve_trafico, NO folio)
- `globalpc_facturas` (has BOTH folio + cve_trafico) ✓
- `globalpc_contenedores` (has cve_trafico, NO company_id — can't query scoped)

**Facturas is the pivot.** Partidas.folio = Facturas.folio.
Facturas.cve_trafico = Traficos.trafico.

### Step 3 — End-to-end verification

```
partida folio=61126 (EVCO)
  → factura cve_trafico='9254-Y1302' (same folio)
  → trafico pedimento='3002281' semaforo=0 (verde)
```

Join chain verified against live production data before writing any
refactor code.

### Why no test caught this

Existing tests mocked Supabase responses — the mocks returned
fixtures matching the phantom-column shape, so tests passed with
happy green output even though prod queries were 400-ing. Static
`tsc` didn't catch it because `.select('cve_trafico')` is a string
literal; Supabase's typed client doesn't validate column names at
compile time.

---

## What shipped this marathon

### 1. Shared helper — `src/lib/queries/partidas-trafico-link.ts`

`resolvePartidaLinks(supabase, companyId, partidas)` returns:
```ts
{
  byFolio: Map<number, {
    cve_trafico, pedimento, fecha_cruce, fecha_llegada,
    semaforo, fecha_facturacion, valor_comercial
  }>
  distinctCveTraficos: string[]
}
```

Internals:
- Chunks .in() clauses (500 at a time) so no folio batch blows
  PostgREST limits
- Tenant-scopes BOTH the facturas query + the traficos query via
  `.eq('company_id', companyId)` — defense in depth
- Tolerates orphans: partidas with no matching factura → not in
  map; factura with no matching trafico → factura-level fields
  preserved, trafico-level nulled
- Coerces invalid semáforo values to null

Plus `applyPartidaLink(partida, links)` convenience when a call site
has exactly one partida.

### 2. Three call-sites migrated

**`src/app/api/catalogo/partes/[cveProducto]/route.ts`** (M7)
- Partidas query: `.select('folio')` instead of `.select('cve_trafico')`
- Enrichment: `resolvePartidaLinks` → `uses_timeline` gets real
  pedimento/fecha_cruce/semaforo per row
- Crossings summary now computes against real data

**`src/lib/catalogo/products.ts`** (M8 + pre-M11) — biggest fix
- Filter partidas by `cve_producto` (real) instead of `descripcion`
  (phantom column — filter was a no-op, every row showed 0 uses)
- Value = `cantidad × precio_unitario` (valor_comercial is on
  facturas, not partidas)
- Last-cruce enrichment via `resolvePartidaLinks` with facturas+traficos
- Merger's key preserved so the rest of the pipeline untouched

**`src/lib/intelligence/crossing-insights.ts`** (M10)
- Partidas query: `.select('folio')` instead of `.select('cve_trafico')`
- Enrichment via `resolvePartidaLinks` before running
  `computePartStreaks` / `computeProveedorHealth` / `detectAnomalies`
- All pure aggregators unchanged — the fix is at the I/O boundary

### 3. Two regression guards — this can't reappear

**Guard A — TypeScript compile-time schema contract:**

`src/lib/queries/__tests__/partidas-trafico-link.test.ts` uses:
```ts
type AssertKeyOf<T, K extends keyof T> = K
type _partidasHasFolio = AssertKeyOf<PartidasRow, 'folio'>
type _facturasHasCveTrafico = AssertKeyOf<FacturasRow, 'cve_trafico'>
type _traficosHasSemaforo = AssertKeyOf<TraficosRow, 'semaforo'>
// ... 18 total
```

These resolve against `Database['public']['Tables'][X]['Row']` from
the auto-generated `types/supabase.ts`. If a future migration drops
or renames any column the helper depends on, `tsc --noEmit` fails
with a clear error.

**Guard B — gsd-verify ratchet:**

New "Schema — Phantom-column guard" gate in `scripts/gsd-verify.sh`
greps `src/` for:
```
.from('globalpc_partidas').select('...cve_trafico...')
.from('globalpc_partidas').select('...descripcion...')
.from('globalpc_partidas').select('...valor_comercial...')
.from('globalpc_partidas').select('...fecha_llegada...')
.from('globalpc_partidas').select('...seq...')
```

Excludes `__tests__/` + `.test.` files. A regression fails the
ship gate immediately. No more 6-month latent bugs of this class.

### 4. Tests — 12 new assertions

`src/lib/queries/__tests__/partidas-trafico-link.test.ts`:
- Empty companyId / empty input / all-null-folios → empty map
- Happy-path 2-hop join
- Orphan folio (no factura) → no entry
- Orphan factura (no trafico) → factura-level fields preserved
- Multiple facturas per folio → first wins
- Invalid semáforo → null
- Distinct cve_traficos dedup
- `applyPartidaLink` convenience helper: attach / null-no-link / null-no-folio

Plus existing 3 parte-detail tenant-isolation tests rewritten to
exercise the new 2-hop mock flow (partidas + facturas + traficos).

---

## Impact

**Pre-M12 prod behavior (hidden by soft-wrappers):**
- `/catalogo` parte detail: `uses_timeline` empty on every SKU
- `/catalogo` list: `veces_importado` = 0 on every row
- `/admin/intelligence`: always empty payload

**Post-M12:**
- Real crossing history on every parte-detail drill-down
- Real use-count + valor aggregates on catalog rows
- Intelligence layer actually aggregates signals

Users see a noticeable UX quality bump — but zero EVCO-surface
code changes. The fix is purely at the data-I/O boundary.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline bcffd8e..HEAD                    # 2 commits
npm install
npx tsc --noEmit                                   # 0 errors
npx vitest run                                     # 1254/1254
bash scripts/gsd-verify.sh --ratchets-only         # 0 failures
```

---

## The real schema — memorized reference

**`globalpc_partidas`** (line-item within an invoice):
```
id, folio, numero_item, cve_cliente, cve_proveedor, cve_producto,
precio_unitario, cantidad, peso, pais_origen, marca, modelo,
serie, tenant_id, created_at, company_id
```

**`globalpc_facturas`** (the pivot — document-level):
```
id, folio, cve_trafico, cve_cliente, cve_proveedor, numero,
incoterm, moneda, fecha_facturacion, valor_comercial, flete,
seguros, embalajes, incrementables, deducibles, cove_vucem,
tenant_id, created_at, updated_at, company_id
```

**`traficos`** (the crossing / customs record):
```
id, trafico, pedimento, fecha_cruce, fecha_llegada, semaforo,
estatus, aduana, patente, company_id, tenant_id, ...40+ more
```

**To join partidas → traficos: always via facturas.**

Documented in Grok Handbook §§26.4–26.5 for every future builder.

---

## The 12-marathon arc

| M | Delivery |
|---|---|
| M2-M8 | EVCO client acquisition + demo readiness |
| M9 | Grok foundation (session-guards + ApiResponse) |
| M10 | V2 intelligence layer + tenant config + 2 primitives |
| M11 | MAFESA activation + 2-registry doc + phantom finding |
| **M12** | **Phantom column fixed · 3 code paths migrated · 2 regression guards shipped** |

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*

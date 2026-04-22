# Phantom-Column Debt Log

Living document tracking every `.from('<table>').select('<phantom_col>')`
site in production code. Run the scanner at any time:

```bash
node scripts/audit-phantom-columns.mjs
```

Last automated scan: **2026-04-21 (M14)** · **63 confirmed sites** after
verification probes.

---

## Why these silently "work" in production

Every phantom query 400s against PostgREST, but the app's soft-query
wrappers (`softCount` / `softData` in `src/lib/cockpit/safe-query.ts`)
swallow the error and return `null` / empty array. The UI renders its
empty-state copy instead of crashing, so users see degraded functionality
without an error message.

Examples of degraded features in prod today:
- `/catalogo` veces_importado column shows 0 for every row (fixed M12)
- `/catalogo/partes/[cve]` timeline was silently empty (fixed M12)
- `/admin/intelligence` had empty payloads (fixed M12)
- `/anexo-24/[cveProducto]` linked pedimentos section was empty (fixed M14)
- Many other admin/API routes return silent empties (see list below)

---

## Fix status

| Status | Count | Notes |
|---|---|---|
| ✅ Fixed | 5 | M12 + M14 |
| 🔴 Open | 63 | Debt. Fix in batches — see triage below |

---

## Triage by demo impact

### Priority A — Ursula's demo path (fix before next EVCO demo)

Currently NONE — the M12 + M14 fixes cleared every phantom on the
surfaces Ursula actually clicks into.

### Priority B — Operator / admin paths (fix when touched)

These appear on `/admin/*`, broker API routes, or operator tools.
Invisible to Ursula but degrade the operator experience.

- `src/app/actions/classification.ts` — `globalpc_partidas`:
  fraccion_arancelaria, fraccion, descripcion, umc, valor_comercial, tmec
- `src/app/api/clasificar/unclassified/route.ts` — `globalpc_productos`:
  cve_trafico, cantidad, unidad, valor_unitario, valor_total
- `src/app/api/classification/[trafico_id]/generate/route.ts` —
  `globalpc_partidas`: same set as actions/classification
- `src/app/api/pedimento/[id]/export/route.ts` — `globalpc_partidas`:
  fraccion_arancelaria, fraccion, valor_comercial
- `src/app/api/pedimento/[id]/preview/route.ts` — same as export
- `src/app/api/cruz-chat/route.ts` — `globalpc_facturas`: pedimento,
  referencia, proveedor, fecha_pago, valor_usd, dta, igi, iva
- `src/app/api/clientes/[id]/config/save-section/route.ts` — `companies`:
  updated_at (easy fix — just remove)
- `src/app/api/clientes/[id]/config/validate/route.ts` — `companies`:
  general, direcciones, contactos, fiscal, aduanal_defaults, ... (these
  are config jsonb sub-paths; the CODE is querying them as top-level
  columns. Might need a `config` jsonb column on companies + this
  becomes a jsonb-path query instead)
- `src/app/api/intelligence/feed/route.ts` — `traficos.trafico_number`,
  `companies.razon_social`
- `src/app/api/labels/print/route.ts` — `companies`: nombre_comercial,
  razon_social
- `src/app/api/doc-guard/route.ts` — `traficos.mve_folio`
- `src/app/api/docs/classify/route.ts` — `expediente_documentos.document_type`
- `src/app/api/docs/reclassify/route.ts` — `expediente_documentos`:
  document_type, document_type_confidence
- `src/app/api/catalogo/vencimientos-watch/route.ts` —
  `globalpc_productos`: nom_numero, nom_expiry, sedue_permit, sedue_expiry,
  semarnat_cert, semarnat_expiry
- `src/app/api/chain/link/route.ts` — `expediente_documentos.trafico_id`
- `src/app/api/lotes/route.ts` — `traficos`: proveedor, fraccion_arancelaria, moneda
- `src/app/api/pedimento-package/route.ts` — `expediente_documentos.nombre`
- `src/app/api/pre-filing-check/route.ts` — `globalpc_facturas`: valor,
  proveedor, cove
- `src/app/api/search/route.ts` — (3 queries across tables)

### Priority C — Shared libs (invisible but foundational)

Fix these early in M15 since many callers depend on them.

- `src/lib/traficos/suggest.ts` — 4 queries with phantoms across
  traficos, globalpc_partidas, globalpc_facturas
- `src/lib/cliente/dashboard.ts` — 3 queries
- `src/lib/search/index.ts` — search layer
- `src/lib/reports/weekly-audit.ts` — 2 queries
- `src/lib/anexo24/snapshot.ts` — Anexo 24 snapshot generation
- `src/lib/anexo24/by-fraccion.ts` — Anexo 24 by-fracción lookup
- `src/lib/catalogo/vencimientos.ts` — certificate expiry tracking
- `src/lib/dormant/detect.ts` — dormant-client detector
- `src/lib/doc-audit.ts` — document audit utility
- `src/lib/ai/client-context.ts` — AI context builder
- `src/lib/aguila/tools.ts` — Anthropic tool definitions (!)
- `src/lib/trace/compose.ts` — trace composition
- `src/lib/launchpad-actions.ts` — admin launchpad
- `src/components/views/proveedores-view.tsx` — proveedor view
- `src/components/cockpit/shared/fetchCockpitData.ts` — cockpit fetch

### Priority D — Other components / pages

- `src/app/embarques/[id]/page.tsx` — 2 queries
- `src/app/clientes/[id]/page.tsx` — 2 queries

---

## Systematic fix recipe (follow for each site)

1. **Grep the phantom query.** Note what columns it's trying to read.
2. **Check the real schema** via `scripts/audit-phantom-columns.mjs` or
   direct probe:
   ```bash
   node -e "..." # (use the _probe-schema.mjs pattern)
   ```
3. **Find the real source of the data.**
   - `partidas.cve_trafico` → real: partidas.folio → facturas.folio+cve_trafico → traficos.trafico
   - `partidas.fraccion/fraccion_arancelaria` → real: globalpc_productos.fraccion (join via cve_producto)
   - `partidas.descripcion` → real: globalpc_productos.descripcion (join via cve_producto)
   - `partidas.valor_comercial` → real: facturas.valor_comercial (join via folio)
   - `traficos.trafico_number` → use `traficos.trafico`
   - `traficos.proveedor` → facturas.cve_proveedor (2-hop)
   - `traficos.fraccion_arancelaria` → partidas via trafico (3-hop)
   - `companies.razon_social` / `nombre_comercial` → use `companies.name`
   - `companies.updated_at` → doesn't exist; companies lacks this column
   - `expediente_documentos.document_type` / `.trafico_id` / `.nombre` →
     use `.doc_type` / `.pedimento_id` / `.file_name`
4. **Refactor the query.** Prefer:
   - For partidas↔traficos: use `resolvePartidaLinks` from
     `src/lib/queries/partidas-trafico-link.ts`
   - For productos join: inline 2nd query on globalpc_productos with
     `.in('cve_producto', [...])`
5. **Run the scanner:** `node scripts/audit-phantom-columns.mjs`. The
   total should decrease by 1 (or however many sites the file had).
6. **Run tests:** `npx vitest run`.

---

## Known schema "gotchas" — the real truth

Based on M11-M14 investigation. Useful reference for Grok.

### Tables with NO `company_id` column (use `tenant_id` instead)

- `globalpc_contenedores` — has `tenant_id` + `cve_trafico`
- `globalpc_ordenes_carga` — has `tenant_id` only
- `globalpc_bultos` — has `tenant_id` only

### Tables with phantom-friendly names

- `globalpc_partidas` — line-items within invoices. Does NOT have
  `cve_trafico`, `descripcion`, `valor_comercial`, `fecha_llegada`, `seq`,
  `fraccion`, `fraccion_arancelaria`, `umc`, `tmec`. Join to traficos
  via `facturas.folio`. Join to productos via `cve_producto`.

- `globalpc_facturas` — invoice/document level. HAS `cve_trafico` (the
  real pivot column). Does NOT have `pedimento`, `valor_usd`, `dta`,
  `igi`, `iva`, `cove` — those live on `traficos` or are derived.

- `traficos` — HAS `trafico` (string ref) + `pedimento` + `fecha_cruce` +
  `semaforo`. Does NOT have `trafico_number`, `proveedor`, `fraccion_arancelaria`,
  `moneda`, `mve_folio`. Proveedores aggregate via facturas.

- `companies` — HAS `name`, `rfc`, `patente`, `aduana`, `branding` (jsonb
  post-M11), `features` (jsonb post-M11). Does NOT have `razon_social`,
  `nombre_comercial`, `updated_at`, `config` (the big jsonb fields the
  clientes/config routes expect).

- `expediente_documentos` — HAS `doc_type`, `file_name`, `file_url`,
  `pedimento_id`. Does NOT have `document_type`, `document_type_confidence`,
  `trafico_id`, `nombre`.

---

## Ratchet

`scripts/gsd-verify.sh` includes a phantom-column gate that was
tightened to the globalpc_partidas-only pattern in M12. A broader
ratchet covering every tenant-scoped table would be more robust; not
shipped yet because 63 existing violations would need baselining.
Tracked for future M15.

---

*Living document. Update as phantoms are fixed.*
*Last marathon: M14 · 2026-04-21.*

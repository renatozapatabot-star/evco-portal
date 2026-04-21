# Block EE · Root Cause

Opened: 2026-04-17, after Phase 1 tenant-audit findings.

## The mechanism

`scripts/globalpc-sync.js` line 370-377:

```js
mapRow: r => ({
  cve_producto: r.cve_producto,
  cve_cliente: r.cve_cliente,      // ← the only trustworthy tenant signal
  cve_proveedor: r.cve_proveedor,
  descripcion: r.descripcion,
  fraccion: r.fraccion,
  umt: r.umt,
  pais_origen: r.pais_origen,
  marca: r.marca,
  precio_unitario: r.precio,
  tenant_id: tenantId,              // ← always FALLBACK_TENANT_ID (fixed uuid)
})
```

**`company_id` is never assigned here.** The sync upserts on
`(cve_producto, cve_cliente, cve_proveedor)` but leaves `company_id`
whatever was already there. New rows get `company_id = NULL`. Old
rows keep whatever a legacy backfill migration stamped on them —
which is why:

- 18 of 51 active companies actually appear as distinct `company_id`
  values in `globalpc_productos` (the rest are NULL or orphaned)
- Orphan claves like `'0405'`, `'0535'` leak in — they were tagged
  before the slug migration (slug is `grupo-pelayo`, not `'0535'`)
- EVCO's 149,710 rows tagged `company_id='evco'` include rows whose
  `cve_cliente` is NOT `'9254'` — those are parts from other clients
  that happened to share a cve_producto with EVCO and got stamped
  EVCO-first by a long-ago migration

The same bug is present in:
- `globalpc_partidas` (distinct company_id = 1 across 290K rows)
- `globalpc_proveedores` (distinct company_id = 1)
- `globalpc_eventos` (distinct = 36, but many are claves not slugs)
- `globalpc_facturas` (orphans: 2258, 8702, 9113, 8384)
- `expediente_documentos` (distinct = 5 — only 5 tenants of 51 have docs)

## The trustworthy signal

`cve_cliente` is populated directly from MySQL `cb_trafico.sCveCliente`
and `cb_producto_factura.sCveCliente` etc. These are authoritative
— they're what GlobalPC thinks, and GlobalPC is the source of record.

Mapping `cve_cliente → company_id slug` lives in `companies.clave_cliente`.
That table IS trustworthy because Renato IV curates it.

## The fix

1. **Reassign `company_id` on every globalpc_* row based on its own
   `cve_cliente`** — a single idempotent UPDATE per table.
2. **Orphan the un-mapped rows** — rows whose `cve_cliente` is not in
   `companies.clave_cliente` get `company_id='orphan-<clave>'` so they
   disappear from client cockpits but stay auditable.
3. **Fix the sync going forward** — `globalpc-sync.js` mapRow includes
   `company_id: companyId` for every globalpc_* write.

No schema change. No row deletion. Fully reversible via a snapshot
table written before the update.

## Side finding — duplicated cve_producto

For EVCO: 149,710 rows / 6,131 distinct cve_producto = ~24× duplicates
per product. This is because the sync conflict key is
`(cve_producto, cve_cliente, cve_proveedor)` — a single product bought
from N different suppliers becomes N rows. That's correct — each
(supplier, product) pair is its own catalog entry. The contamination
is separate from this.

## Why the user sees "Tornillo" for EVCO

The 1,503 contaminated EVCO rows include parts like "INSERT LOCK NUT",
"GLASS CLOTH ELECTRICAL TAPE", "O-RING" — these were stamped with
`company_id='evco'` by a legacy backfill even though their
`cve_cliente` is NOT `'9254'`. After the fix, they'll re-tag to
their true owner (or orphan out).

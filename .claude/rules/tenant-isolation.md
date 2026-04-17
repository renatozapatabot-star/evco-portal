# Tenant isolation — never again (Block EE · 2026-04-17)

> Written after the contamination incident that forced Block EE. 303,656
> rows had to be retagged because `globalpc-sync.js` wrote every
> globalpc_* row WITHOUT `company_id`. Legacy backfill stamps never got
> reconciled. Ursula could see Tornillo parts on EVCO's /catalogo.
>
> This file is the load-bearing contract that prevents a repeat. Every
> future session reads it before touching any multi-tenant code path.

---

## The non-negotiable contract

**Every write to a tenant-scoped table MUST include `company_id`.**

Tenant-scoped tables (must include `company_id` on every write):

```
globalpc_productos · globalpc_partidas · globalpc_facturas · globalpc_eventos
globalpc_proveedores · globalpc_contenedores · globalpc_ordenes_carga
globalpc_bultos · anexo24_partidas · pedimento_drafts
traficos · entradas · expediente_documentos · audit_log · sync_log
classification_log · pedimento_ocas · mensajeria_* · proveedor_rfc_cache
```

If you add a new tenant-scoped table, add it here in the same PR.

---

## The ownership signal hierarchy

When deriving ownership, trust these sources in order:

| Rank | Source | Authority |
|------|--------|-----------|
| 1 | `anexo24_partidas.numero_parte` | SAT-filed regulatory truth |
| 2 | `globalpc_partidas.cve_producto` (parent trafico belongs to client) | Operational authoritative |
| 3 | `<table>.cve_cliente` → `companies.clave_cliente` | MySQL-native assignment |
| 4 | `<table>.company_id` slug | Derived — only as good as the sync writer |

**`company_id` is derived, never authoritative.** If it disagrees with
the upstream signal (cve_cliente), the upstream wins. That's the
invariant the Block EE retag enforced.

---

## Onboarding a new client

Run this sequence. Any step out of order leaks contamination.

1. **`companies` row FIRST.** Before any sync runs, the tenant must
   have `{company_id, clave_cliente, name, active: true}` in the
   `companies` table. The `clave_cliente` is the MySQL-native key
   GlobalPC uses. The `company_id` is the clean slug the portal uses.
2. **One slug per clave.** No long-form + short-form duplicates. The
   48 duplicates caught in Block EE's dry-run (`calfer` vs
   `calfer-de-mexico-s-a-de-c-v`) are now archived as `active=false` —
   don't reintroduce.
3. **Dry-run first.** Run `node scripts/tenant-reassign-company-id.js
   --dry-run` with the new tenant present. Zero unexpected plans
   means the mapping is clean.
4. **RLS + defense-in-depth.** New tenant-scoped tables ship with RLS
   policies in the same migration. App code still filters by
   `session.companyId` — RLS is the safety net, not the primary gate.
5. **Smoke `/admin/monitor/tenants`** after first sync. Row counts
   appear in the dashboard within 60s. Orphan-tagged rows mean a
   mapping gap.

---

## The write patterns

### Sync scripts (server-side, service role)

```js
mapRow: r => ({
  cve_producto: r.cve_producto,
  cve_cliente: r.cve_cliente,
  // …
  company_id: companyId,        // ← non-negotiable, Block EE rule
  tenant_id: tenantId,
})
```

No fallbacks. No `'unknown'`. No `'evco'` default. If the MySQL row
has a `cve_cliente` that isn't in the `companies` allowlist, the
sync SKIPS the row + fires a Telegram alert. See
`scripts/globalpc-delta-sync.js` line 212 for the reference pattern.

### Reads from tenant-scoped tables

Portal code uses `session.companyId` (from the HMAC session, not a
URL/cookie/header override):

```ts
const { data } = await supabase
  .from('globalpc_productos')
  .select('*')
  .eq('company_id', session.companyId)   // required filter
```

Admin surfaces can override via `session.role in ['admin','broker']`
but must never fetch without a tenant filter. Violating this is
core-invariant #6 (RLS + defense-in-depth) breach.

### Catalog surfaces

The catalog-style queries (things that could show cross-tenant parts
if naive) MUST route through `getActiveCveProductos()` which reads
the client's own `globalpc_partidas` for the verified cve set.

```ts
const verifiedCves = activeCvesArray(
  await getActiveCveProductos(supabase, session.companyId)
)
productoQuery = productoQuery
  .eq('company_id', session.companyId)
  .in('cve_producto', verifiedCves)
```

Without the `.in()` filter, every row tagged `company_id='evco'` —
including anything a past legacy sync left behind — surfaces.

---

## Auditing

### Monthly + before any tenant onboarding

```bash
node scripts/tenant-audit.js
# outputs .planning/tenant-audit-YYYY-MM-DD.json + TENANT_TRUTH_FINDINGS.md
# reports contamination_pct per client
```

Any client with `contamination_pct > 30%` → investigate in the same
session. Do not defer.

### Continuous

- `/admin/monitor/tenants` — row counts per client + orphan panel (60s refresh)
- `/api/health/data-integrity` — 8 tables probed + 4 Block-EE invariants (#18-21)
- `gsd-verify.sh` ratchets — catch drift at pre-commit

### When drift is detected

1. Run `node scripts/tenant-reassign-company-id.js --dry-run` first.
2. If the plans look sensible (only legacy slug → clean slug OR
   unknown-clave → orphan-<clave>), drop `--dry-run` and execute.
3. Re-run `node scripts/tenant-audit.js` to confirm.
4. `npm run ship` to refresh the baseline.

---

## Forbidden patterns

**Never write any of these:**

1. `company_id: r.sCveCliente || 'unknown'` — fallbacks mask mapping gaps
2. `company_id: FALLBACK_TENANT_ID` — there is no legitimate fallback
3. `.eq('cve_cliente', '9254')` — hardcoded EVCO clave; use
   `session.companyId` + the companies table mapping
4. Reads from `globalpc_productos` without either a `company_id`
   filter OR RLS (depending on the code path)
5. Migrations that back-fill `company_id` from arbitrary columns
   without writing to `tenant_ownership_log` or equivalent audit trail
6. Bulk operations that loop over clients and write with a stale
   `companyId` variable from the outer loop (the notorious "every row
   gets stamped with the last client's id" pattern)

---

## Block EE proofs

What Block EE shipped that keeps this from recurring:

- **303,656 rows retagged** via `scripts/tenant-reassign-company-id.js`
  (idempotent, can re-run at any time to re-anchor)
- **Sync writer hardening** — `globalpc-sync.js` mapRow now writes
  `company_id: companyId` on all 8 globalpc_* writes
- **4 new integrity invariants** in `scripts/data-integrity-check.js`:
  - #18 company_id in active-companies allowlist
  - #19 ≥ 8 of 15 sampled clients have partida rows
  - #20 EVCO productos/partidas ratio ≤ 2.0
  - #21 orphan company_id rows ≤ 25K
- **`/admin/monitor/tenants`** — observability dashboard, 60s refresh
- **`tenant-audit.js` + `tenant-purge-stale-productos.js`** — tools
  preserved for future investigations

---

## The lesson in one line

**Trust `cve_cliente` (MySQL-native). Derive `company_id`. Never let
a sync write either without both.**

---

*Codified in Block EE · 2026-04-17. Every future Claude session on this
repo reads this file before touching any sync script, tenant-scoped
table, or cockpit query.*

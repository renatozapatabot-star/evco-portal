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
globalpc_proveedores · anexo24_partidas · pedimento_drafts
traficos · entradas · expediente_documentos
pedimento_ocas · mensajeria_* · proveedor_rfc_cache
operator_actions · agent_decisions · notifications
pedimento_facturas
```

**Mixed-scope tables (company_id MAY be NULL for infrastructure-level rows):**

```
sync_log         → per-tenant runs MUST stamp company_id
                   (risk_scorer, risk_feed).
                   Infra-wide runs MAY be NULL
                   (globalpc_delta, email_intake, content_intel).
audit_log        → broker-internal events MAY be NULL; client-scoped
                   actions MUST stamp company_id.
classification_log → uses legacy `client_id + ts` keys, NOT
                     `company_id`. Queries must join on those.
```

**Tables without company_id (out of scope for this contract):**

```
globalpc_contenedores · globalpc_ordenes_carga · globalpc_bultos
heartbeat_log · clients
```

These reach tenant scope transitively (e.g. `globalpc_bultos` →
`globalpc_ordenes_carga` → `cve_cliente` → `companies`). Reads must
still filter via the parent's tenant key.

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

### `/api/data` cross-tenant escalation fence (2026-05-05)

The `/api/data` route is the single most-trafficked tenant boundary
— almost every cockpit read fans through it. Pre-2026-05-05 a client
passing `?company_id=mafesa` got a 200 with EVCO data (silent ignore).
The session.companyId always won the filter, so no leak — but the
silence was bad telemetry: an attacker probing the surface, or a
security auditor running curl, could not tell the bypass attempt
failed.

Post-fix, **any client-role request whose `?company_id=`,
`?cve_cliente=`, or `?clave_cliente=` does not match the session's
own tenant returns 403 + writes an `audit_log` row** with action
`cross_tenant_attempt`. The fence:

```ts
// src/app/api/data/route.ts (excerpt)
if (!isInternal) {
  const escalations: Array<{ via: string; attempted: string }> = []
  if (queryCompanyId && queryCompanyId !== sessionCompanyId) {
    escalations.push({ via: 'company_id_param', attempted: queryCompanyId })
  }
  if (claveCliente || cveCliente) {
    const { data: ownClave } = await supabase
      .from('companies').select('clave_cliente')
      .eq('company_id', sessionCompanyId).maybeSingle()
    const sessionClave = ownClave?.clave_cliente ?? null
    if (claveCliente && claveCliente !== sessionClave) escalations.push(...)
    if (cveCliente && cveCliente !== sessionClave) escalations.push(...)
  }
  if (escalations.length > 0) {
    supabase.from('audit_log').insert({
      action: 'cross_tenant_attempt', resource: 'api/data',
      company_id: sessionCompanyId, diff: { ...escalations, ip, ua },
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

**Internal roles (broker/admin) bypass this fence by design** — they
pass `?company_id=` legitimately for oversight (see core-invariant
#31). No audit row written for those requests.

**Generic 'Forbidden' body** — the fence does not leak which tenant
exists or which param tripped it.

Run `bash scripts/test/cross-tenant-probe.sh` against any deployed
environment after touching this route. The probe expects 403 on three
attack shapes and 200 on the default-scoping path. Run after every
prod deploy that touches `src/app/api/data/route.ts`:

```bash
BASE_URL=https://portal.renatozapata.com \
CLIENT_SESSION='<portal_session cookie value>' \
bash scripts/test/cross-tenant-probe.sh
```

Audit-log queryability lets us answer "did anyone try to cross
tenants today?" in one SQL query:
```sql
select * from audit_log
where action = 'cross_tenant_attempt'
  and created_at > now() - interval '7 days'
order by created_at desc;
```

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

**This includes the CRUZ AI tool layer.** Every `.from('globalpc_productos')`
call in `src/lib/aguila/tools.ts` (and any future AI-tool file that queries
a tenant-scoped table) MUST apply the allowlist for client-role sessions.
Admin/broker sessions with `allClients=true` intentionally bypass both
filters for oversight — that branch is legitimate, but a client-role path
that misses the `.in()` is a regression. The Phase 7 regression test
(`src/lib/aguila/__tests__/tools.catalogo.test.ts`) asserts this contract;
breaking it breaks the test. Audited + fixed 2026-04-19 (Sunday data-trust
marathon) — `execQueryCatalogo` was written on 2026-04-16 before Block EE
codified this rule and was the last remaining catalog surface missing
the guard.

### Scope resolution refuses unknown client filters

`resolveClientScope()` in `src/lib/aguila/tools.ts` throws
`AguilaForbiddenError('scope:unknown_client:...')` when an internal
caller passes a `clientFilter` that doesn't resolve to a company in the
`companies` table. Silently dropping to an unfiltered query on a typo
would cross-tenant; refuse instead. All five tool executors inherit this
guard because they all call `resolveClientScope` first.

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

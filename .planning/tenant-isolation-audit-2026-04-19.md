# Tenant isolation audit — traficos schema forensics

- **Date:** 2026-04-19
- **Scope:** `traficos` table cross-tenant leak risk before Ursula/EVCO credential send on Monday 2026-04-20
- **Analyst:** Claude (source + live Supabase read probes via service-role and anon keys)

## VERDICT: **SEV-1 DO-NOT-SHIP.** Tenant data is exposed to the public anon key.

Source-only review concluded "no exploitable leak via the portal." **That conclusion was wrong.** A 5-second live probe against `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the same key shipped to every browser in the portal JavaScript bundle — returns rows from every tenant's `traficos`, `companies`, `expediente_documentos`, and `globalpc_productos`. The portal's HMAC session is only a UI gate. **The database itself has no RLS enforcement on the tables Ursula's browser will hit.**

Concrete evidence below (run at 2026-04-19 against production Supabase):

```
anon.from('traficos').select('*', {count:'exact',head:true}) → 32,376 rows
anon.from('traficos').select('trafico, company_id').eq('company_id', 'hilos-iris').limit(3)
  → [{"trafico":"5343-Z4668","company_id":"hilos-iris"},
     {"trafico":"5343-X0787","company_id":"hilos-iris"},
     {"trafico":"5343-Y3749","company_id":"hilos-iris"}]
anon.from('companies').select('*').limit(3) → returns every tenant's name + clave
anon.from('expediente_documentos').select('*').limit(3) → returns other-tenant docs
anon.from('globalpc_productos').select('*').limit(3) → returns every tenant's parts catalog
```

**Ursula (or anyone who view-sources the portal, or anyone she shares her browser with) can read every customs record for every one of the 51 active tenants under Patente 3596.** This violates:

- Core invariant #12 ("RLS on every Supabase table, tested in the migration file").
- Core invariant #13 ("Cross-client data exposure is a regulatory violation, not just a bug").
- `.claude/rules/tenant-isolation.md` — the whole point of Block EE.
- `CLAUDE.md` MUST-NEVER list: "Expose cross-client data."

Writes are less clear. `UPDATE` and `DELETE` returned HTTP 204 with no error but were against `WHERE trafico = '__never_exists__'`, which also returns 204 on an RLS-blocked table. That test is inconclusive for writes. An `INSERT` was rejected by the `traficos_tenant_id_fkey` FK constraint (23503), which is a schema block, not an RLS block. **Read exposure is certain; write exposure is plausible and unverified.** Treat writes as exposed until confirmed otherwise.

---

## Live counts — what's actually in the DB (service-role probe)

| Column | Value | Meaning |
|---|---|---|
| Total `traficos` rows | **32,376** | Full historical corpus across 51 active tenants |
| `company_id = 'evco'` | **3,449** | The actual "EVCO" slice — what the portal shows Ursula |
| `tenant_slug = 'evco'` | **6,928** | User's original surprise number — vestigial broad stamp |
| `client_id = 'evco'` | **32,376** | EVERY ROW. Confirmed single-tenant bulk stamp. Dead column. |
| `company_id IS NULL` | **0** | Good — invariant 7 holds |
| `companies.traficos_count` (evco row) | **1,000** | **ALSO WRONG** — explained below |

**The `companies.traficos_count=1,000` is a bug, independent of this audit.** `scripts/nightly-pipeline.js:326-343` does:
```js
const { data: traficosAll } = await supabase.from('traficos')
  .select('trafico, estatus, fecha_llegada, fecha_cruce')
  .eq('company_id', company_id)
const total = traficosAll?.length || 0
await supabase.from('companies').update({ traficos_count: total, ... })
```
No `.limit()`. Supabase's default cap is 1,000 rows, so `.length` silently clamps. **Every company with `traficos_count = 1000` is actually ≥1,000.** Scan the Q4 block below — eleven companies hit that suspicious round number:

```
castores         clave=5913  count=1000  (memory says this client actually has 10 tráficos — another sign of broken counter)
pti-dos          clave=0627  count=1000
garlock          clave=5020  count=1000
embajada1-2      claves=318x count=1000 each
evco             clave=9254  count=1000  ← actual = 3,449
```

Fix is a one-line `.limit(100000)` or count-only query. Not a security issue, but the "launch-readiness" dashboard is lying.

## Question 1 — which column is authoritative?

**`company_id` in the application layer. `cve_cliente` (MySQL) upstream. Everything else is noise.**

| Column | Role | Writer | Reader | Status |
|---|---|---|---|---|
| `company_id` | Authoritative read filter | `scripts/globalpc-sync.js:178` (`company_id: companyId`). Block EE tenant-isolation rule pins it. | Every portal read path. | **PRIMARY — but unprotected by RLS** |
| `tenant_slug` | Legacy mirror of `company_id` | Sync writes it = companyId. `scripts/rls-migration.sql:14` did a one-shot conditional backfill. | Zero portal reads filter by it. | **STALE — still shows 'evco' on 3,479 rows that belong to other tenants** |
| `tenant_id` | UUID placeholder | Sync writes `FALLBACK_TENANT_ID` for every row | Never filtered | Cosmetic. Same UUID for everyone. |
| `client_id` | Single-tenant-era bulk stamp | Not written by current sync at all | Not read on `traficos` | Dead column. Stamped 'evco' on all 32,376 rows. |

## Question 2 — why `client_id='evco'` on every row?

Confirmed by live query: **all 32,376 rows have `client_id='evco'`**. This predates multi-tenant. The current `mapRow` doesn't include `client_id` at all (see `scripts/globalpc-sync.js:177-191`), so the column just retains its historical default. It is not a tenant identifier and nothing on `traficos` reads it.

(The only `client_id` reads in `src/` — `src/app/api/catalogo/partes/[cveProducto]/route.ts:87,110` — target `classification_log`, which legitimately uses `client_id` + `ts` per a documented learned rule. Not `traficos`.)

## Question 3 — is 1,000 or 6,928 the right count?

**Neither. EVCO has 3,449 traficos by the authoritative column.** 1,000 is `companies.traficos_count` clamped by the Supabase default-1000-row cap bug. 6,928 is `tenant_slug='evco'` which includes 3,479 rows that actually belong to other tenants and have `company_id` correctly set elsewhere.

Phantom drift distribution (top 15 non-EVCO tenants whose rows still carry `tenant_slug='evco'`):

```
eskidraulics-international-s-a : 55
mt-equipos-y-accesorios-indust : 48
l-care-mexicana-s-de-r-l-de-c- : 46
aure-quim-s-a-de-c-v            : 44
mariscal-moda-hombre-s-a-de-c-  : 43
vexzamex-materiales-industrial  : 33
rodillos-industriales-america-  : 32
fernando-martinez-ruiz-del-hoy  : 31
proand-s-a-de-c-v               : 30
building-applied-technologies-  : 29
qcontroll-s-de-r-l-de-c-v       : 26
fabrica-de-mermeladas-s-a-de-c  : 25
bexel-internacional-s-a-de-c-v  : 22
suministros-weston-s-a-de-c-v   : 22
industria-hi-cap-s-a-de-c-v     : 20
```

Each of these has its `company_id` set to the correct tenant (not `'evco'`) — the phantom is only on `tenant_slug`. Block EE's retag touched globalpc_* tables and got `company_id` right; nothing ever revisited `tenant_slug` on `traficos`. Since no portal code filters on `tenant_slug`, the phantom is cosmetic — but it is a perfect test canary for any future query mistakenly filtering by the wrong column.

The 4 rows that truly have `company_id='evco'` AND `trafico NOT LIKE '9254-%'` are legacy cruft, not cross-tenant leaks:

```
925A-Y0477  (2023-05-18) — typo clave (925A instead of 9254)
99995       (null date)  — numeric test/seed row
EVCO        (2012-04-04) — ancient seed row with literal 'EVCO' as trafico
97000       (null date)  — numeric test/seed row
```

Ursula will see these 4 junk rows if she filters her account broadly. Not a leak — but they are dirty data. Deleting them or excluding them with a prefix guard is a 5-minute follow-up.

**Orphan check**: 0 rows with `trafico LIKE '9254-%'` have `company_id ≠ 'evco'`. Good — no EVCO data is hidden behind another tenant.

## Question 4 — what does the portal query actually look like?

Unchanged from the source-review section of the original audit. Pattern is always `.eq('company_id', session.companyId)` via HMAC-signed session. See `src/app/inicio/page.tsx:179`, `src/app/embarques/[id]/page.tsx:54`, `src/app/api/data/route.ts:160-188`. Ursula cannot forge a different `companyId` through the portal.

**What the source review missed:** the portal is not the only way to reach the data. Anyone with the anon key — which is literally embedded in the portal's JavaScript bundle — can bypass the portal entirely and hit Supabase REST directly. `session.companyId` filters nothing there.

## Question 5 — cross-tenant leak risk for Ursula

**CONFIRMED, via the public anon key.** Ursula's browser downloads `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL`. With those, from a 10-line HTML page:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const c = supabase.createClient(URL, ANON_KEY)
  const { data } = await c.from('traficos').select('*').eq('company_id', 'hilos-iris').limit(1000)
  console.log(data)
</script>
```

She sees Hilos Iris's entire customs history. Same for `expediente_documentos`, `globalpc_productos`, `companies`, and by extension every tenant-scoped table that lacks RLS. A competitor who gets the anon key (or any other client) can do the same.

Write exposure is unverified. `UPDATE/DELETE` returned 204 on a non-matching `WHERE`, which proves nothing either way. **Assume writes are also exposed until a migration adds `FOR ALL USING (false)` to every tenant-scoped table.** A malicious write could delete a trafico, re-assign a pedimento, flip a semáforo — each one a regulatory incident.

## What blocks Monday — minimum fix

Three migrations, in this order. None of them require code changes in the portal (service-role calls bypass RLS).

1. **Enable RLS + deny-all to anon on every tenant-scoped table.**
   ```sql
   ALTER TABLE traficos ENABLE ROW LEVEL SECURITY;
   DROP POLICY IF EXISTS traficos_deny_anon ON traficos;
   CREATE POLICY traficos_deny_anon ON traficos FOR ALL USING (false);
   -- repeat for: entradas, expediente_documentos, globalpc_productos,
   -- globalpc_partidas, globalpc_facturas, globalpc_eventos,
   -- globalpc_proveedores, globalpc_contenedores, globalpc_ordenes_carga,
   -- globalpc_bultos, anexo24_partidas, pedimento_drafts, audit_log,
   -- classification_log, pedimento_ocas, mensajeria_*, proveedor_rfc_cache,
   -- companies, + any other tenant-scoped table (full list in
   -- .claude/rules/tenant-isolation.md).
   ```
   Service-role reads (every portal `/api/*` endpoint) bypass this automatically. Anon reads die.

2. **Verify portal still works end-to-end** with the deny-all policy — hit `/inicio`, `/embarques`, `/api/data?table=traficos`, `/embarques/[id]` as Ursula's session. Any page that falls back to a `NEXT_PUBLIC_SUPABASE_ANON_KEY` client call breaks loudly; fix by routing through a service-role API endpoint.

3. **Re-run this audit's anon probe post-migration.** Expected: every table that was exposed above returns 0 rows or a permission error.

## Non-blocking follow-ups (post-launch)

- Fix `nightly-pipeline.js` `traficos_count` to not silently cap at 1,000. At least 11 tenants currently report the clamped number.
- Add `traficos` to `scripts/tenant-reassign-company-id.js`'s `TABLES` list and run the retag to clean the 3,479 phantom `tenant_slug` stamps.
- Delete the 4 legacy junk rows (`925A-Y0477`, `99995`, `EVCO`, `97000`) or exclude them with a `.like('trafico', '9254-%')` guard on EVCO-scoped queries.
- Drop the `client_id` column from `traficos` (dead — nothing reads it).
- Populate `tenant_id` per-tenant or drop it (same UUID for everyone is a trap).
- Extend `scripts/data-integrity-check.js`:
  - `traficos with company_id='evco' AND trafico NOT LIKE '9254-%' AND trafico IS NOT NULL` — assert ≤ 10 (catches new contamination, tolerates the 4 legacy junk rows).
  - `traficos where company_id != tenant_slug AND tenant_slug IS NOT NULL` — assert 0 post-retag (canary for the drift class of bug).
  - A test that opens an anon-keyed Supabase client and asserts `.from('traficos').select('*').limit(1)` returns **permission_denied**, not data. This is the regression guard against today's finding.

## Amendment note

This document supersedes the earlier commit (`644c171`) which concluded "NO exploitable leak for Ursula via the portal." That conclusion held for the portal surface but was framed too narrowly — the portal is not the only route to the data. The real exposure is at the database layer, not the application layer.

---

## Appendix A — Full blast radius (37-table anon-key sweep)

Of 37 tenant-scoped or tenant-adjacent tables sampled with the public anon key, **36 are readable to anonymous browsers.** (The 37th, `operational_decisions`, timed out on every query shape — neither confirmed open nor confirmed blocked.)

| Table | Rows exposed to anon |
|---|---|
| `traficos` | 32,376 |
| `entradas` | 64,790 |
| `expediente_documentos` | 214,124* |
| `globalpc_productos` | 149,710* |
| `globalpc_partidas` | 22,599* |
| `globalpc_facturas` | 64,467 |
| `globalpc_eventos` | count timed out; plain select returns rows |
| `globalpc_proveedores` | 1,972 |
| `globalpc_contenedores` | 26,706 |
| `globalpc_ordenes_carga` | 18,866 |
| `globalpc_bultos` | 58,093 |
| `anexo24_partidas` | 1,793 |
| `pedimentos` | 4,107 |
| `pedimento_drafts` | 2,185 |
| `companies` | 307 (every tenant's name + clave_cliente) |
| `supplier_network` | 101 |
| `cruz_conversations` | 33 |
| `sync_log` | 801 |
| `system_config` | 7 (FX rates, DTA rates) |
| `regulatory_alerts` | 3 |
| `audit_log` / `classification_log` / `pedimento_ocas` / `proveedor_rfc_cache` | 0 (empty table, no visible policy) |
| `mensajeria_threads` / `mensajeria_messages` | 0 |
| `push_subscriptions` / `service_requests` / `user_preferences` | 0 |
| `client_requests` / `calendar_events` / `streak_tracking` | 0 |
| `tipo_cambio_history` / `trafico_notes` / `agent_decisions` | 0 |
| `workflow_events` | 0 (anon returns empty — may be RLS, may be low-volume) |

\* `count: 'exact'` timed out server-side (57014). Plain `.select('*').limit(2)` returned rows successfully, confirming the tables are readable — totals from `scripts/data-integrity-check.js` baseline at 2026-04-17.

**Conservative minimum exposure**: ~660,000 rows of customs data (traficos + entradas + expediente_documentos + globalpc_productos + globalpc_partidas + globalpc_facturas + globalpc_bultos) visible to anonymous browser traffic. Every tenant, every shipment, every document record.

## Appendix B — Is the anon key actually in Ursula's browser?

Yes. `grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/` returns 10+ `'use client'` pages that instantiate Supabase with the key at module load time: `/calls`, `/calendario`, `/monitor`, `/simulador`, `/comunicaciones`, `/logros`, `/drafts`, `/admin/aprobaciones`, `/facturacion`. Next.js inlines `NEXT_PUBLIC_*` values into the client bundle at build time. Anyone who opens View Source or DevTools on portal.renatozapata.com finds the key plus `NEXT_PUBLIC_SUPABASE_URL` within seconds.

## Appendix C — Migration gap: 6 exposed tables not covered by `20260420_rls_sev1_deny_all.sql`

Cross-checked the 25-table list in the staged migration (commit `6330a25`) against the 37-table anon-key sweep. **Six tables confirmed readable to anon are NOT in the migration table array** and will remain exposed after the migration is applied:

| Table | Rows exposed | Notes |
|---|---|---|
| `pedimentos` | 4,107 | SAT-audit data. Patente 3596 regulatory record. Must be covered. |
| `cruz_conversations` | 33 | Every tenant AI chat transcripts — user_message + cruz_response columns. |
| `supplier_network` | 101 | Cross-tenant supplier intelligence. |
| `regulatory_alerts` | 3 | Tenant-scoped compliance alerts. |
| `anexo24_partidas` | 1,793 | **Migration header claims this was already RLS'd by `20260418_anexo24_parts.sql` — live probe contradicts that.** Either that earlier migration only ran `ENABLE ROW LEVEL SECURITY` without a deny-all policy (default is then permissive), or it was never applied. Verify before trusting the "already RLS'd" comment list. |
| `system_config` | 7 | Lower sensitivity (FX rates, DTA rates). Recommend deny — default-allow silently leaks any future tenant-scoped config. |

**Recommended amendment**: append these six to the `tables` array in `supabase/migrations/20260420_rls_sev1_deny_all.sql` before running in Supabase SQL editor. The migration is idempotent — re-running after amendment is safe.

Also re-probe every table the migration header comment lists as already RLS-covered — the `anexo24_partidas` miss means that list cannot be trusted without verification. Candidates to re-verify with the anon key: `globalpc_productos`, `globalpc_partidas`, `classification_log`, `proveedor_rfc_cache`, `audit_log`, `mensajeria_*`, plus the 20260512_rls_b8 family.

## Appendix D — Earlier source-only audit (`644c171`) is preserved

The prior commit remains in the branch history intentionally. It documents what a source-only audit concluded and where that conclusion was too narrow. Future audits should treat "portal reads are safe" and "database reads are safe" as two separate questions — the portal's `session.companyId` filter is a UI convenience, not a tenant gate. Only RLS (or revoking the anon key entirely) is a tenant gate.

---

*Live probes run 2026-04-19 from the `overnight/ursula-ready` working copy. Service-role for diagnostic counts; `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the exposure test. Temporary probe scripts removed after run.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*

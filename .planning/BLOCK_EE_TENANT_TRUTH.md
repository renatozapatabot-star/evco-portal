# Block EE · Tenant-Truth Reconciliation

**Opened:** 2026-04-17, post Block DD ship (HEAD 9b86fa8).
**Directive:** "Clean the whole thing up, make no mistakes. EVCO catalog is
contaminated (Tornillo showing up, ~44 real parts hypothesis unverified).
Contamination is systemic — not one table. Fix root cause so future syncs
stay clean."

---

## The problem in one sentence

`globalpc_productos` reports 149,710 rows tagged `company_id='evco'`, but
EVCO actually moves a small fraction of that. Parts they do not trade
(Tornillos) appear on their catalog. Every tenant-scoped table is
potentially contaminated the same way, and we don't have the ground
truth anywhere.

## Why it happens (hypothesis — Phase 2 will confirm)

`scripts/globalpc-sync.js` line 15 defines `FALLBACK_TENANT_ID` and the
row mapper does `claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'`.
Every row with an unknown or blank `sCveCliente` in GlobalPC's MySQL
silently falls through. If any fallback maps to EVCO — or any historical
run used the wrong default — the cruft stays forever because nothing
removes it.

## Ground-truth sources (ranked by authority)

| Rank | Source | What it proves |
|------|--------|---|
| 1 | `anexo24_partidas.numero_parte` | SAT-filed regulatory truth |
| 2 | `globalpc_partidas.cve_producto` where parent trafico belongs to client | Actual operational usage |
| 3 | `globalpc_facturas.cve_cliente` → `companies.clave_cliente` | MySQL-native client assignment |
| 4 | `traficos.descripcion_mercancia` token overlap | Fallback free-form authoritative |

A part is "real" for client X if it appears in **any** of sources 1-3
under X's scope. Anything in `globalpc_productos.company_id=X` that
does NOT appear in any source 1-3 is contamination.

---

## Plan

### Phase 1 · Discovery (read-only, safe)

**Goal:** Know exactly what's in the DB, no assumptions.

1. `scripts/tenant-audit.js` — new diagnostic, read-only
   - For every active company in `companies`:
     - Count rows per tenant-scoped table (`globalpc_productos`,
       `globalpc_partidas`, `globalpc_facturas`, `globalpc_eventos`,
       `traficos`, `entradas`, `expediente_documentos`,
       `anexo24_partidas`, `pedimento_drafts`)
     - Compute truth set per rank (1-4 above)
     - Compute contamination ratio per table
   - Outputs `.planning/tenant-audit-2026-04-17.json` + markdown summary
2. Write findings to `.planning/TENANT_TRUTH_FINDINGS.md`

### Phase 2 · Root cause

1. Re-read `scripts/globalpc-sync.js` + every other script that writes
   to tenant-scoped tables. Identify every code path that sets
   `company_id` — especially fallbacks.
2. Grep `claveMap[` + `FALLBACK_TENANT_ID` + `'evco'` + `'unknown'` +
   `|| 'evco'` across `scripts/`.
3. Document every path in `.planning/TENANT_ROOT_CAUSE.md`.

### Phase 3 · Truth infrastructure

**Goal:** Make ownership explicit, verifiable, auditable.

1. Migration `supabase/migrations/20260418_tenant_ownership.sql`:
   - `ALTER TABLE globalpc_productos ADD COLUMN ownership_verified boolean DEFAULT NULL`
   - `ADD COLUMN ownership_source text` (`anexo24 | partidas | facturas | traficos | manual | none`)
   - `ADD COLUMN ownership_verified_at timestamptz`
   - `CREATE INDEX ON globalpc_productos (company_id, ownership_verified)`
   - Same for `globalpc_partidas`, `globalpc_facturas` as `company_id_verified boolean`
2. New table `tenant_ownership_log` — append-only, every decision auditable:
   ```
   id · table_name · row_pk · old_company_id · new_company_id ·
   verification_source · decided_at · decided_by · reason
   ```
3. View `v_tenant_truth_per_company` — one row per (company_id, cve_producto)
   combining all authoritative sources.

### Phase 4 · Reconciliation (idempotent, snapshot-first)

**Goal:** Stamp every row with truthful `ownership_verified`.

1. `scripts/tenant-reconciler.js`:
   - Pre-flight: `EXPORT` current state of every tenant-scoped table
     to `scripts/.purge-snapshots/2026-04-17/` as CSV
   - For each `(cve_producto, company_id)` in `globalpc_productos`:
     - Source 1 check: in client's `anexo24_partidas`?
     - Source 2 check: in client's `globalpc_partidas`?
     - Source 3 check: `globalpc_facturas.cve_cliente` owns it?
     - If any → `ownership_verified=true`, log source
     - If none → `ownership_verified=false`
   - Write every decision to `tenant_ownership_log`
   - Idempotent — re-run is safe
2. Dry-run first — report planned changes without writing

### Phase 5 · Cockpit flip

**Goal:** Client sees truth, admin sees audit.

1. `/catalogo` filters `ownership_verified=true OR ownership_verified IS NULL`
   → then `true` only, once Phase 4 stamps every row
2. `/inicio` nav counts use verified-only queries
3. `/admin/monitor/tenants` new page — per-company row counts,
   contamination ratio, recent anomalies, link to ownership_log
4. Admin toggle on `/catalogo`: "Mostrar sin verificar" surfaces the
   cruft for inspection

### Phase 6 · Destructive cleanup (snapshot-gated)

**Goal:** Physical deletion after a 24-48h soak.

1. Pre-delete CSV export (redundant with Phase 4 snapshot)
2. `scripts/tenant-purge.js` — destructive:
   - `DELETE FROM globalpc_productos WHERE ownership_verified = false
     AND company_id IN (SELECT company_id FROM companies WHERE active = true)`
   - Idempotent — re-run purges any new cruft
3. Re-run `data-integrity-check.js` — expect green
4. Re-run `/api/health/data-integrity` — expect green

### Phase 7 · Sync hardening (prevention)

**Goal:** No new contamination, ever.

1. `scripts/globalpc-sync.js`:
   - **Remove** `FALLBACK_TENANT_ID` — throw `UnmappedTenantError` instead
   - Replace `claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'` with
     `const cid = claveMap[r.sCveCliente]; if (!cid) { skipped.push(r); continue; }`
   - Write skipped rows to `sync_skipped_rows` table + Telegram alert
     if skipped > 0.5% of total
2. Pre-sync gate: `scripts/pre-sync-check.js` queries MySQL for distinct
   `cve_cliente` values, verifies every one has a `companies` mapping.
   Halts sync before writing if any unmapped.
3. Same retrofit for `globalpc-delta-sync.js`, `full-sync-facturas.js`,
   `full-sync-eventos.js`, `full-sync-productos.js`.

### Phase 8 · Observability

1. `/admin/monitor/tenants` dashboard (new page, admin-only):
   - Per-company row counts across 9 tables
   - `ownership_verified` ratio per company
   - Last 20 ownership_log entries
   - Unmapped `cve_cliente` alerts from last 7d
2. Telegram alert rules:
   - New tenant contamination > 1% → amber
   - Unmapped `cve_cliente` → red (blocks sync)
   - `ownership_verified` ratio drop > 5% → red

### Phase 9 · Data-integrity invariants

Extend `scripts/data-integrity-check.js` with 4 new checks:

- **#18** — No `globalpc_*` row with `company_id` not in `companies` allowlist
- **#19** — No `globalpc_*` row with `cve_cliente` not in
  `companies.clave_cliente` (or a registered alias)
- **#20** — `ownership_verified` ratio per active client ≥ 95%
- **#21** — `sync_skipped_rows` in last 24h < 0.5% of total sync volume

### Phase 10 · Ship + baseline

1. `npm run ship` — all 6 gates (typecheck + 641+ tests + build + ratchets +
   integrity probe + rollback bundle + Vercel + live smoke + baseline)
2. New baseline `.claude/rules/baseline-2026-04-18.md` with I24-I32
3. Update CLAUDE.md BUILD STATE block
4. Live smoke:
   - `curl /api/health/data-integrity` → verdict=green
   - `/catalogo` for EVCO shows the true verified set
   - `/admin/monitor/tenants` renders per-company health

---

## Safety rails

1. **No destructive op without a snapshot.** Every delete script exports
   CSV first to `scripts/.purge-snapshots/YYYY-MM-DD/`
2. **Dry-run before every write script.** `--dry-run` flag shows the
   plan without executing
3. **Idempotent only.** Every mutation can be re-run safely
4. **Append-only audit.** `tenant_ownership_log` is FOR DELETE USING (false)
5. **GlobalPC MySQL read-only.** Per CLAUDE.md — never write there
6. **eConta untouched.** Anabel's domain, deferred
7. **RLS preserved.** New columns + tables get policies in their migration
8. **Rollback on red.** Any post-deploy verdict=red → `vercel rollback`

---

## Execution order (linear, not parallel)

1. Phase 1 — Discovery (30-60 min)
2. Phase 2 — Root cause (20-30 min)
3. Phase 3 — Truth infrastructure (1 hour — migration + types)
4. Phase 4 — Reconciliation dry-run (30 min)
5. Phase 4 — Reconciliation execute (30 min)
6. Phase 5 — Cockpit flip (1 hour)
7. Ship interim (gates 1-5)
8. Phase 6 — Destructive cleanup (after 24-48h soak OR immediately if
   user approves after dry-run review — user said "no mistakes")
9. Phase 7 — Sync hardening (1 hour)
10. Phase 8 — Observability dashboard (1 hour)
11. Phase 9 — New integrity invariants (30 min)
12. Phase 10 — Final ship + baseline

---

## Explicit scope

**In scope:**
- globalpc_productos, globalpc_partidas, globalpc_facturas,
  globalpc_eventos, globalpc_contenedores, globalpc_ordenes_carga,
  globalpc_bultos, globalpc_proveedores
- traficos, entradas, expediente_documentos
- anexo24_partidas
- pedimento_drafts

**Out of scope (Block EE does NOT touch):**
- eConta tables
- system_config, user_mensajeria_threads, any audit_log
- GlobalPC MySQL (source system, read-only forever)
- CRUZ AI interaction tables

---

*Opened by Renato IV directive 2026-04-17. "Take all permissions needed to
execute it flawlessly. Make no mistakes." Full authorization granted for
diagnostic + reconciliation + ship flows.*

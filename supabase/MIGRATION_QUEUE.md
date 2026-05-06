# Supabase Migration Queue

> What's pending application to the live Supabase Pro project. Update this
> file in the same commit that adds a new migration so operators never
> push blind.

**Policy:** every new `.sql` file in `supabase/migrations/` lands here
with its rationale, expected effect, and rollback plan. Remove the row
once `npx supabase db push` has been run against production AND
verification passed.

---

## How to apply

```bash
cd ~/evco-portal

# 1. Preview what will run (no write)
npx supabase db diff --linked

# 2. Apply to production
npx supabase db push

# 3. Regenerate typed client
npx supabase gen types typescript --linked > types/supabase.ts
git add types/supabase.ts
git commit -m "chore(types): regen after <migration-slug>"

# 4. Verify (see per-migration verification below)
```

If `--linked` is not configured on this machine, operator must run
`npx supabase link --project-ref <ref>` first (gate kept for secrets
isolation — the project ref is in 1Password under "CRUZ Supabase").

---

## Currently pending

### `20260505180000_pedimento_facturas_schema.sql`

**Rationale:** Block 8 Invoice Bank base table — referenced by 14
codebase sites + 5 routes (`/api/invoice-bank`, `/api/invoice-bank/[id]`,
`/api/invoice-bank/upload`, `/api/inbox`, `/api/inbox/accept`) but the
CREATE TABLE migration was never authored. Production has been
returning PGRST205 "Could not find the table 'public.pedimento_facturas'
in the schema cache" since the feature shipped — observed and
documented in PR #36 (`fcbcb29`, 2026-05-05).

PR #36 hardened the listing route to return 200 with
`{ rows: [], meta: { schema_pending: true } }` when the table is
missing. THIS migration ships the actual table so the feature works
end-to-end.

**Expected effect:** Creates `public.pedimento_facturas` with 16
columns + status/currency CHECKs + 7 indexes (4 from this migration,
3 carried-over from `20260422190000_invoice_dedup.sql` definitions —
declared idempotently in both migrations so order doesn't matter).
RLS enabled with `pedimento_facturas_deny_all FOR ALL USING (false)`
— same pattern as `agent_actions`, `workflow_findings`,
`lead_activities`. Service-role bypasses; app-layer
`session.companyId` filter is the primary tenant gate.

**Apply order:** must run BEFORE
`20260422190000_invoice_dedup.sql` in a fresh environment, but the
dedup migration is itself idempotent (`ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`) so the order is forgiving. In
production where the dedup migration is "applied" against a missing
table, this migration ships the table; re-running the dedup migration
afterwards is a safe no-op.

**Verification post-apply:**
```sql
-- Expect 16 columns:
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'pedimento_facturas'
  ORDER BY ordinal_position;

-- Expect 1 RLS policy: pedimento_facturas_deny_all · FOR ALL · USING (false):
SELECT pol.polname, pol.polcmd
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  WHERE c.relname = 'pedimento_facturas';

-- Expect 7 indexes (1 PK + 3 from this migration + 3 from dedup):
SELECT indexname FROM pg_indexes WHERE tablename = 'pedimento_facturas';
```

**Live smoke (after apply):**
```bash
# Authenticate as evco2026 + hit the listing endpoint:
curl -b portal_session=… https://portal.renatozapata.com/api/invoice-bank
# Pre-apply : { rows: [], meta: { schema_pending: true } }
# Post-apply: { rows: [], meta: { total: 0, hasMore: false } }
#             — schema_pending flag absent, table queried successfully.
```

**Cross-tenant probe** (mirrors PR #34 pattern): with the listing
endpoint working, run `BASE_URL=https://portal.renatozapata.com
CLIENT_SESSION=… bash scripts/test/cross-tenant-probe.sh` — except the
probe doesn't yet target this route. Add `/api/invoice-bank` as a
target in a follow-up PR if the cross-tenant fence pattern is desired
on this surface (the route is already client-locked via
`resolveTenantScope`, so the fence is an observability upgrade,
not a security upgrade).

**Rollback:** `DROP TABLE IF EXISTS pedimento_facturas CASCADE`. Data
loss is limited to whatever invoice rows exist — none expected at
apply time since the feature has been returning empty since launch.
Re-applying the dedup migration after the rollback would `ADD COLUMN`
to a missing table and 40000-class error; sequence rollbacks correctly.

**Follow-up after green:** once the table exists in production, the
schema-cache-miss branch in `src/app/api/invoice-bank/route.ts`
(commit `f05d61c`, lines ~118-135) becomes dead code. Remove in a
separate sweep PR — the empty-rows behavior is still a valid default,
the `schema_pending: true` metadata flag is the part that becomes
stale.

### `20260422190000_invoice_dedup.sql`

**Rationale:** Phase 1 of V2 Doc Intelligence — duplicate-invoice
detection. Adds three nullable columns to `pedimento_facturas`
(`file_hash`, `normalized_invoice_number`, `supplier_rfc`) plus three
partial indexes for O(log n) dedup lookups.

**Expected effect:** Upload route starts writing the new columns on
every insert. Legacy rows stay valid (columns are nullable). Three new
indexes appear in the `pedimento_facturas` pg_stat view. No RLS change.

**Verification post-apply:**
```sql
-- Expect 3 new columns, all nullable:
SELECT column_name, is_nullable FROM information_schema.columns
  WHERE table_name = 'pedimento_facturas'
    AND column_name IN ('file_hash','normalized_invoice_number','supplier_rfc');

-- Expect 3 new indexes:
SELECT indexname FROM pg_indexes WHERE tablename = 'pedimento_facturas'
  AND indexname LIKE 'idx_pedimento_facturas_%';
```

**Rollback:** `DROP INDEX IF EXISTS` the three indexes, then `ALTER
TABLE pedimento_facturas DROP COLUMN IF EXISTS file_hash,
normalized_invoice_number, supplier_rfc`. Data loss is limited to the
new columns — nothing else depends on them yet.

---

## Applied this session (2026-04-21)

`20260421150251_leads_table.sql` applied via `npx supabase db push`
(CLI path, not Path B). Required one `supabase migration repair
--status reverted 20260420` first to clear the orphan ghost row in
the remote `schema_migrations` table (documented tech debt from the
2026-04-20 session). The repair is metadata-only — no schema object
dropped, just history-table cleanup.

Applied via Supabase CLI · verified post-apply via `npx supabase
migration list --linked`:

```
✓ leads table (25 columns, UUID PK, audit timestamps)
✓ 5 indexes (stage, source, next_action_at, owner, created_at DESC)
✓ leads_touch_updated_at() trigger function
✓ leads_touch_updated_at_trg BEFORE UPDATE trigger
✓ RLS enabled + leads_deny_all policy (service-role bypass only)
✓ types/supabase.ts regenerated — `leads` type exports at line 6429
```

**Tech debt status:** the 20260420 orphan is now cleared. Remote
`schema_migrations` and local `supabase/migrations/` are fully in
sync. Future `supabase db push` calls will not require repair.

---

## Applied earlier (2026-04-20)

All 3 migrations were applied directly via `npx supabase db query
--linked` (not `supabase db push` — local/remote migration history
was divergent with 142 pending repair commands; decision was to
skip the CLI migration-history reconcile and apply schema changes
via the direct SQL execution path instead). Path B of this runbook.

Applied via service role · verified post-apply:

```
✓ system_config row:   fx_savings_heuristic_pct  (value + valid_to 2027-01-01)
✓ idx_expediente_documentos_company_uploaded
✓ idx_globalpc_productos_company_cve
✓ idx_globalpc_partidas_company_cve
✓ idx_globalpc_partidas_cve_producto
✓ idx_entradas_company_fecha_llegada
✓ idx_traficos_company_fecha_cruce
✓ idx_globalpc_productos_classified_at  (partial WHERE fraccion_classified_at IS NOT NULL)
```

**Separate tech debt:** migration_history table on remote remains
out of sync with local migrations/ — 142 local files, zero rows in
remote history. This predates today's session. Cleaning it up
requires someone to audit which of the 142 are actually in the
schema vs authored-but-not-applied (several are future-dated), then
running `supabase migration repair --status applied/reverted` per
file. Deferred — does not block functionality, just the next
`supabase db push` caller.

---

## Historical (reference)

### ~~`20260420_fx_savings_heuristic.sql`~~ · APPLIED 2026-04-20

### `20260420_fx_savings_heuristic.sql`

**What:** seeds `system_config` with the `fx_savings_heuristic_pct` key
(default 0.008 = 0.8%, valid_to 2027-01-01).

**Why:** `scripts/cost-optimizer.js` used to hardcode `const
fxSavingsPct = 0.008` inside `analyzeFilingTiming()`. Commit `74b67db`
moved the value to system_config with graceful-skip on missing. This
migration ensures the heuristic actually fires for the Sunday-04:00
cost-optimizer cron on new deployments / tenants. Without it, the
filing-timing insight silently skips.

**Rollback:** `DELETE FROM system_config WHERE key =
'fx_savings_heuristic_pct';` (safe; cost-optimizer degrades
gracefully).

**Verification:**

```sql
SELECT key, value, valid_to FROM system_config
WHERE key = 'fx_savings_heuristic_pct';
-- expect 1 row, rate=0.008, valid_to 2027-01-01
```

Then run next Sunday 04:00 cost-optimizer cycle and grep pm2 logs for
"filing-timing insight" — should be present, not the "skipping"
console.log.

### ~~`20260420_perf_indexes.sql`~~ · APPLIED 2026-04-20

**What:** adds 4 indexes on hot-path tables:

| Table | Columns | Powers |
|---|---|---|
| `expediente_documentos` | `(company_id, uploaded_at DESC)` | `/inicio` KPI tiles (307K rows) |
| `globalpc_productos` | `(company_id, cve_producto)` | catalog `.in()` lookups (148K rows) |
| `globalpc_partidas` | `(company_id, cve_producto)` | partidas→productos joins (22K rows) |
| `globalpc_partidas` | `(cve_producto)` | back-filter catalog (previously 0 indexes on this table) |

### ~~`20260420_inicio_hot_path_indexes.sql`~~ · APPLIED 2026-04-20

**What:** supplementary to the first perf pass — adds 3 more compound
indexes discovered by line-by-line review of `src/app/inicio/page.tsx`:

| Table | Columns | Powers |
|---|---|---|
| `entradas` | `(company_id, fecha_llegada_mercancia DESC)` | `entradas.semana` count (65K rows, previously **zero indexes**) |
| `traficos` | `(company_id, fecha_cruce)` | `.is('fecha_cruce', null)` + `.gte('fecha_cruce', monthStart)` — both directions |
| `globalpc_productos` | `(company_id, fraccion_classified_at) WHERE NOT NULL` | `catalogo.mes` classification-date filter (partial index avoids overhead on null-classified rows) |

**Why:** first pass (perf_indexes.sql) focused on agent-reported
tables; second pass came from reading the actual `/inicio` SSR
queries. Together they cover the 12 softCount + 7 softData queries
run per client cockpit render.

**Rollback:**

```sql
DROP INDEX IF EXISTS idx_entradas_company_fecha_llegada;
DROP INDEX IF EXISTS idx_traficos_company_fecha_cruce;
DROP INDEX IF EXISTS idx_globalpc_productos_classified_at;
```

**Verification:**

```sql
EXPLAIN (ANALYZE, BUFFERS)
  SELECT count(*) FROM entradas
  WHERE company_id = 'evco'
    AND fecha_llegada_mercancia >= now() - interval '7 days';
-- expect: "Index Scan using idx_entradas_company_fecha_llegada"
```

**Why:** performance budgets in CLAUDE.md §PERFORMANCE BUDGETS (dashboard
< 2s FCP, tráfico list < 1s interactive). Existing indexes were verified
before writing the migration — no duplicates. `globalpc_partidas` had
ZERO indexes; every join through it was a seq-scan.

**Rollback:**

```sql
DROP INDEX IF EXISTS idx_expediente_documentos_company_uploaded;
DROP INDEX IF EXISTS idx_globalpc_productos_company_cve;
DROP INDEX IF EXISTS idx_globalpc_partidas_company_cve;
DROP INDEX IF EXISTS idx_globalpc_partidas_cve_producto;
```

Indexes are write-path overhead — minor on these tables (nightly sync +
15-min delta). Safe to drop if storage pressure appears.

**Verification:**

```sql
EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM globalpc_productos
  WHERE company_id = 'evco' AND cve_producto = ANY(ARRAY['X1','X2']);
-- expect: "Index Scan using idx_globalpc_productos_company_cve"
-- NOT:    "Seq Scan" + "Filter"
```

Also time the `/inicio` page before/after — FCP should drop by 100-300ms
on the KPI tile aggregation.

---

## Application order

All migrations are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO
UPDATE`) so order doesn't matter. Apply in filename order by convention:

1. `20260420_fx_savings_heuristic.sql`
2. `20260420_perf_indexes.sql`
3. `20260420_inicio_hot_path_indexes.sql`

---

## Post-apply

- Update `scripts/CRON_MANIFEST.md` if any cron becomes newly enabled
- Remove this file's "Currently pending" rows once verified
- `git commit -m "chore(migration-queue): drain <slug>"`

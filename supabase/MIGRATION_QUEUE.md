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

## Currently pending (as of 2026-04-20 07:45 CT)

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

### `20260420_perf_indexes.sql`

**What:** adds 4 indexes on hot-path tables:

| Table | Columns | Powers |
|---|---|---|
| `expediente_documentos` | `(company_id, uploaded_at DESC)` | `/inicio` KPI tiles (307K rows) |
| `globalpc_productos` | `(company_id, cve_producto)` | catalog `.in()` lookups (148K rows) |
| `globalpc_partidas` | `(company_id, cve_producto)` | partidas→productos joins (22K rows) |
| `globalpc_partidas` | `(cve_producto)` | back-filter catalog (previously 0 indexes on this table) |

### `20260420_inicio_hot_path_indexes.sql`

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

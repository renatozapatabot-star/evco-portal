# Migrating the Schema — Agent Recipe

Step-by-step guide for adding a column, table, or constraint without
tripping any of the 5 guard-rail layers. Reads in ~4 minutes. Every
step cites the rule/section it keeps us aligned with.

## When to follow this recipe

- Adding a new column to an existing tenant-scoped table
- Adding a new table (whether tenant-scoped or shared)
- Adding a constraint (unique index, RLS policy, check constraint)
- Backfilling existing rows for a new column
- Renaming a column (rare; prefer new column + backfill + drop)

**Skip this recipe when:**
- The change is a pure data backfill without schema change (use a
  one-off script under `scripts/backfill-*.js` instead)
- You're adding to the jsonb payload of an existing column (no
  migration needed, just update the consumers + schema-contracts tests
  if the new key is load-bearing)

## The 8-step recipe

### Step 1 — Write the migration file

Location: `supabase/migrations/YYYYMMDDHHMMSS_<descriptive>.sql`.

File-naming: timestamp prefix (UTC), snake_case body. The timestamp
ordering is how Supabase decides apply order.

```sql
-- 20260422140000_add_health_score_to_companies.sql
-- Purpose: track per-tenant operational health score for the
--         /admin/eagle "fleet health" tile. Nullable so existing
--         rows stay valid until the scorer backfills.

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS health_score smallint
  CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100));

-- RLS: companies already has policies; no new policy needed for this
-- column since it's covered by the table-level rules.

COMMIT;
```

**Rules:**
- Always wrap in `BEGIN; ... COMMIT;` for atomicity.
- Always use `IF NOT EXISTS` / `IF EXISTS` clauses for idempotency.
- Always include a CHECK constraint if the column has a bounded
  range (semáforo 0..2, health_score 0..100, etc.).
- Never modify a deployed migration — create a new one instead.
- Add a comment block at the top explaining WHY (not WHAT — the SQL
  tells what).

### Step 2 — Apply locally (or against a dev branch)

```bash
# If you have a local Supabase instance:
npx supabase db push

# Otherwise (apply against the linked dev project — NEVER prod):
npx supabase db push --linked
```

Verify with:

```sql
-- From supabase SQL editor or psql:
\d companies    -- psql
-- Or
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'companies' AND column_name = 'health_score';
```

### Step 3 — Update `src/lib/schema-contracts.ts`

This is the compile-time real-column tuple Grok agents reference
when using `col('companies', '…')`. Any new real column goes here.

```ts
// src/lib/schema-contracts.ts
export const COMPANIES_COLUMNS = [
  // ...existing columns...
  'health_score',   // NEW — M-XX migration
] as const
```

**Why this matters:** the typed `col('companies', 'health_score')`
helper becomes available immediately. Without this step, agents using
the helper get a TS error and don't know the column exists.

### Step 4 — Update the schema-contracts test

File: `src/lib/__tests__/schema-contracts.test.ts`.

```ts
it('companies uses name + active, not razon_social/...', () => {
  expect(COMPANIES_COLUMNS).toContain('name')
  expect(COMPANIES_COLUMNS).toContain('active')
  expect(COMPANIES_COLUMNS).toContain('health_score')  // NEW — add assertion
  // ...existing phantom-guard assertions...
})
```

Also update the count test if it asserts a specific column count:

```ts
it('companies has N real columns (post-migration-X)', () => {
  expect(COMPANIES_COLUMNS.length).toBe(<NEW_COUNT>)
})
```

### Step 5 — Update the handbook §28.2 cheat sheet

File: `docs/grok-build-handbook.md`, §28.2 "Canonical real-schema
reference". Add the new column to the table's real-column list:

```
**`companies` — tenant registry**

Real: id (uuid), company_id (slug, the tenant key), name, rfc, patente,
      aduana, clave_cliente, globalpc_clave, active, branding (jsonb),
      features (jsonb), contact_name, contact_email, contact_phone,
      immex, language, tmec_eligible, portal_password, portal_url,
      onboarded_at, first_login_at, first_question_at, last_sync,
      health_score (0-100 nullable),   ← NEW
      health_grade, health_details, health_breakdown,
      health_score_updated, traficos_count, created_at
```

**Why this matters:** §28.2 is the hand-readable reference Grok opens
when "what columns are on this table?" — keep it in sync with the
actual schema.

### Step 6 — Backfill existing rows (if needed)

If the new column is non-nullable OR needs a default value derived
from other columns, write a backfill script.

Location: `scripts/backfill-<descriptive>.js` (or `.ts` with `tsx`).

```js
// scripts/backfill-health-scores.js
// Backfill companies.health_score from the latest
// operational_decisions entry per tenant.
// Idempotent: re-running sets the same score.

import { createClient } from '@supabase/supabase-js'
import { sendTelegram } from './lib/telegram.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function main() {
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .is('health_score', null)
    .limit(500)
  let updated = 0
  for (const c of companies ?? []) {
    const score = await computeHealthScore(c.company_id)
    if (score == null) continue
    await supabase.from('companies')
      .update({ health_score: score })
      .eq('company_id', c.company_id)
    updated++
  }
  return { updated }
}

main()
  .then(async (result) => {
    console.log('backfill done:', result)
    if (result.updated > 0) {
      await sendTelegram(`🟢 Backfilled health_score for ${result.updated} companies.`)
    }
  })
  .catch(async (err) => {
    await sendTelegram(`🔴 Backfill failed: ${err.message}`)
    process.exit(1)
  })
```

**Rules** (see handbook §39.5):
- Idempotent — re-running gives same result.
- Telegram alert on failure.
- Filter by `IS NULL` so a second run doesn't double-process.
- Never runs from CI — operator invokes manually after migration.

### Step 7 — Run the full gate

```bash
npx tsc --noEmit                                           # 0 errors
npx vitest run                                             # all green
                                                           # (includes new schema-contracts assertions)
bash scripts/gsd-verify.sh --ratchets-only                 # 0 failures
node --env-file=.env.local scripts/audit-phantom-columns.mjs
                                                           # ✓ Zero phantom references
```

If any new column is missing from `schema-contracts.ts`, the phantom
scanner will flag it. If any consumer uses the column without the
helper, the scanner + tests will catch drift.

### Step 8 — Commit

```
feat(schema): companies.health_score — 0..100 operational health

Nullable smallint with CHECK (0 <= health_score <= 100). Backfill
script at scripts/backfill-health-scores.js (operator runs manually
after apply).

schema-contracts.COMPANIES_COLUMNS updated to include the new
column. Handbook §28.2 cheat sheet + §37 primitive reference updated.
Schema-contracts test asserts presence + column count.

1367 → 1368 tests green. Phantom scanner clean.

Rollback: DROP COLUMN companies.health_score; + revert
schema-contracts.ts + handbook. The column is additive, no read
paths depend on it yet.
```

## Rollback order (if something goes wrong)

Always **reverse** the apply order:

1. Revert the code commits (schema-contracts.ts, handbook, tests)
   first.
2. Only then roll back the database migration:
   ```bash
   # New migration that undoes the previous one:
   supabase/migrations/YYYYMMDDHHMMSS_rollback_<previous_migration>.sql
   ```
3. Apply the rollback migration.
4. Verify gates pass post-rollback.

**Never** roll back the database before reverting the code — the
code will reference a column that no longer exists and 400 every
read path.

## Multi-tenant table additions

If you're adding a NEW table (not just a column), you also need:

1. **RLS enabled** in the migration:
   ```sql
   ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "tenant_scope" ON my_new_table FOR ALL USING (false);
   -- service role bypasses; HMAC session JWT policies match false.
   -- See .claude/rules/tenant-isolation.md for the pattern.
   ```

2. **Add to `schema-contracts.ts` SchemaTable union:**
   ```ts
   export type SchemaTable =
     | 'traficos' | 'globalpc_partidas' | 'globalpc_facturas'
     | 'globalpc_productos' | 'globalpc_proveedores' | 'companies'
     | 'expediente_documentos' | 'entradas'
     | 'my_new_table'   // NEW
   ```

3. **Add a real-column tuple** for it.

4. **Update `COMPANY_ID_TABLES` list** in the phantom-column scanner
   at `scripts/audit-phantom-columns.mjs` so the broader ratchet
   covers the new table.

5. **Update handbook §28.2** with the new table's cheat sheet entry.

## Type regeneration

After any schema change:

```bash
npx supabase gen types typescript --linked > types/supabase.ts
```

Run this before committing so `types/supabase.ts` matches the live
schema. The generated file is checked in — stale types = broken
intellisense for downstream callers.

## Common pitfalls

| Mistake | What happens | Fix |
|---|---|---|
| Modified a deployed migration | The checksum drifts; next `db push` errors | Create a new migration instead |
| Forgot to update schema-contracts.ts | `col()` helper rejects the new column | Add to the real-column tuple + test |
| Forgot to enable RLS on new table | Cross-tenant data exposure | Add `ENABLE ROW LEVEL SECURITY` in the same migration |
| Backfilled without `IS NULL` filter | Second run double-processes | Filter + use idempotent keys |
| Non-idempotent migration | Re-apply fails | `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` |
| Renamed column in-place | Every reader breaks simultaneously | Add new column → backfill → switch readers → drop old, across 3 migrations |

## Related reading

- `.claude/rules/supabase-rls.md` — RLS policy pattern
- `.claude/rules/tenant-isolation.md` — multi-tenant contract
- `.claude/rules/core-invariants.md` — rule #12 (RLS required)
- Handbook §28.2 — canonical real-schema cheat sheet (keep this in sync)
- Handbook §37.2 — schema-contracts primitive (the type-level layer)
- `src/lib/schema-contracts.ts` — the SSOT real-column tuples
- `scripts/audit-phantom-columns.mjs` — the scanner that enforces the ratchet

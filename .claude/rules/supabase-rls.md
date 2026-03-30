---
description: Supabase, RLS, and database rules for CRUZ portal
paths:
  - "supabase/**/*"
  - "src/lib/supabase*"
  - "src/app/api/**/*"
  - "src/lib/api*"
---

# Supabase & RLS Rules — CRUZ

## Client Isolation (the #1 rule)

Every query touching client data MUST filter by `client_code`. This is enforced at two levels:
- **RLS policies** on every table using `current_setting('app.client_code', true)`
- **Application-level** filters as defense-in-depth

Never rely on RLS alone. Always include `client_code` in WHERE clauses. RLS is the safety net, not the primary mechanism.

## RLS Policy Pattern

Every new table follows this exact pattern:
```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_[table_name]" ON [table_name]
  USING (client_code = current_setting('app.client_code', true));

-- Test: Set client_code to 'evco', query should only return EVCO rows
-- Test: Set client_code to 'duratech', EVCO rows must be invisible
```

## Migration Rules

- One migration per logical change. Don't bundle unrelated schema changes.
- Migration filenames: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Every migration that adds a table MUST include RLS in the same file.
- After migration: `npx supabase gen types typescript --local > types/supabase.ts`
- Never modify a deployed migration. Create a new one.

## Query Patterns

Parameterized queries only. If you see string interpolation near a Supabase query, stop and fix:

```typescript
// WRONG — SQL injection risk
const { data } = await supabase
  .from('traficos')
  .select('*')
  .eq('status', `${userInput}`)  // NO

// RIGHT
const { data } = await supabase
  .from('traficos')
  .select('*')
  .eq('status', userInput)  // Supabase parameterizes this
```

## Supabase Client Usage

- `createBrowserClient()` — client components only. Uses anon key.
- `createServerClient()` — server components and route handlers. Can use service role for admin ops.
- Service role key NEVER in client code. NEVER in `NEXT_PUBLIC_` env vars.
- Set `app.client_code` in the Supabase client config per-request, derived from the authenticated user's session.

## Indexes

Every new query pattern needs an index check:
- Querying by `client_code` + `status`? Compound index required.
- Querying by `trafico_number`? Unique index required.
- Querying by `pedimento_number`? Unique index required.
- Querying by `mve_deadline` for compliance checks? Index on `(client_code, mve_deadline)`.

Write the index migration in the same PR as the query.

# Tenant isolation audit — traficos schema forensics

- **Date:** 2026-04-19
- **Scope:** `traficos` table cross-tenant leak risk before Ursula/EVCO credential send on Monday 2026-04-20
- **Analyst:** Claude (code-only audit — no live DB queries run; conclusions grounded in migration, sync, and portal-read source)
- **Verdict:** **NO EXPLOITABLE LEAK for Ursula via the portal.** The 5,928-row gap between `companies.traficos_count` (1,000) and `SELECT count(*) WHERE tenant_slug='evco'` (6,928) is vestigial contamination in NON-authoritative columns that no portal read path consults. But the DB is dirtier than the data-integrity check admits, and `traficos` was never covered by the Block EE retag — so a `cleanup + retag` pass is warranted before any second-client onboarding.

---

## 1. Which column is the authoritative client linkage?

**`company_id` is the READ-PATH authoritative column.** Every portal query, every cockpit, every `/api/data` route filters on it. The other three columns are not:

| Column | Role | Writer | Reader | Authority |
|---|---|---|---|---|
| `company_id` | **Authoritative read filter** | `scripts/globalpc-sync.js:178` (writes `company_id: companyId` per client loop). `scripts/nightly-pipeline.js:329` counts on it. Block EE tenant-isolation rule pins it. | Every portal read (inicio, embarques, detail, `/api/data`). | **PRIMARY** |
| `tenant_slug` | Mirror of `company_id` for legacy RLS indexing | `scripts/globalpc-sync.js:178` writes `tenant_slug: companyId`. `scripts/rls-migration.sql:14` did a one-shot `UPDATE … SET tenant_slug = company_id WHERE tenant_slug IS NULL AND company_id IS NOT NULL`. | **Zero portal reads filter by it.** `grep -rn "\.eq\('tenant_slug'" src/` returns 0. Only writers on `scripts/globalpc-sync.js:707,750` (intra-sync bookkeeping). | VESTIGIAL |
| `tenant_id` | UUID placeholder | Sync writes `tenant_id: FALLBACK_TENANT_ID` — a single env-sourced UUID used for every tenant. See `scripts/globalpc-sync.js:16` "Fallback tenant_id for companies without one in the DB". | Never filtered in portal code. | COSMETIC (NOT NULL column, same value for all clients — useless for isolation) |
| `client_id` | Legacy single-tenant stamp | Not written by the current sync at all. Column is nullable. Sampled rows show constant `'evco'` — consistent with a pre-multi-tenant bulk stamp. | `grep -rn "\.eq\('client_id'" src/app src/lib` → 0 matches on `traficos`. (Two matches in `src/app/api/catalogo/partes/[cveProducto]/route.ts:87,110` are against `classification_log`, a different table that legitimately uses `client_id` by documented convention.) | DEAD COLUMN on `traficos` |

**Upstream-source authority** (per `.claude/rules/tenant-isolation.md`) is `cve_cliente` on the MySQL side → mapped to `company_id` via `companies.clave_cliente`. `traficos` does NOT carry a `cve_cliente` column — but the trafico string itself encodes the clave as prefix (`9254-*` = EVCO clave 9254). The sync's `WHERE sCveTrafico LIKE '${clave}-%'` filter is what actually binds ownership at ingest.

**Validation from repo docs:**
> `docs/CRUZ_CONTEXT_2026-04-10.md:41` — "The real isolation key on `traficos` and `globalpc_productos` is `company_id`, NOT `client_id` (which is a constant identifying the brokerage)."

---

## 2. Why is `client_id='evco'` on every row, including other companies' traficos?

**It's a vestigial single-tenant bulk stamp that the multi-tenant refactor never cleared.** When this codebase was literally "evco-portal" (the branch name still carries the scar), every row in `traficos` got stamped with the string identifier of the first/only client. When Hilos Iris, Dist Parra, Ferretera MIMS et al. were added:

1. The sync script started writing `company_id`, `tenant_id`, `tenant_slug` — never `client_id`. See `scripts/globalpc-sync.js:177-191`. The `mapRow` for traficos literally does not include a `client_id` key.
2. Historical rows retained `client_id='evco'`.
3. New rows from any tenant inherited `client_id='evco'` by default (from whatever migration or backfill set the column default, or because the upsert doesn't touch that column).
4. No migration ever dropped or reset `client_id` on `traficos`.

**Why it's not dangerous:**
- Nothing reads `client_id` from `traficos` in `src/`. The only `client_id` reads in the codebase are against `classification_log`, where the column is the legitimate tenant column (per documented legacy convention — see learned rule about `classification_log` using `client_id` + `ts`).
- An attacker who managed to filter on `client_id='evco'` would get 6,928+ rows — but no portal UI exposes such a filter to clients.

**Recommended cleanup (post-launch, non-blocking):** `ALTER TABLE traficos DROP COLUMN client_id` — or a migration that nulls it so `grep` can't find the stale 'evco' token at all. Defer; the risk is zero today.

---

## 3. Which count is correct — 1,000 or 6,928?

**Both are factually true; neither is the answer Ursula cares about. The portal-effective count is 1,000.**

- **1,000** — `companies.traficos_count` for EVCO. Written by `scripts/nightly-pipeline.js:326-346` which runs `SELECT … FROM traficos WHERE company_id='evco'` and writes the `length` to `companies.traficos_count`. This is the number that matches what Ursula will actually see through any portal surface (every read filters on `company_id`).

- **6,928** — rows where `tenant_slug='evco'`. 5,928 of those have `company_id ≠ 'evco'` (most likely `company_id IS NULL` or `'orphan-*'` or a legacy slug that was later overwritten for other tables but not here).

**Why the gap exists:**
- `scripts/rls-migration.sql:14` did a one-time "tenant_slug = company_id" backfill BUT only `WHERE tenant_slug IS NULL`. Rows with a pre-existing `tenant_slug='evco'` stamp (from whenever tenant_slug was first added) were never updated when `company_id` later got a different value.
- Critically, **Block EE's retag script (`scripts/tenant-reassign-company-id.js:37-46`) only covered the 8 `globalpc_*` tables. `traficos` is NOT in that list.** So any pre-Block-EE mis-stamping of `traficos.company_id` was never corrected. The sync has been writing `company_id` correctly since Block EE (2026-04-17), but only for rows it actively re-visits. Historical rows that are no longer returned by the per-client `LIKE '${clave}-%'` MySQL query never get touched again.
- The 5,928-row delta is almost certainly: rows with legacy `tenant_slug='evco'` and `company_id` that is either `NULL`, `'orphan-9254'`, or mapped to a different current slug. None of them are visible to Ursula because her session's `company_id` filter ='evco' excludes them.

**Unresolvable without live query:** I cannot tell from source alone whether any rows have `company_id='evco'` but `trafico` prefix from a different clave (cross-contamination in the authoritative column). The Block EE integrity check `grep -A2 "No traficos with null company_id"` (scripts/data-integrity-check.js:135) catches NULL, but does NOT catch "tagged EVCO but prefix says HILOS-*". **Adding that check is the most valuable follow-up from this audit.**

---

## 4. What does a portal query look like when filtered to 'evco'?

Three canonical shapes, all using the HMAC-signed `session.companyId` (never cookies/query for client role). Cookie/header forging cannot change the filter because `session.companyId` is HMAC-signed by `SESSION_SECRET` and the `verifySession()` implementation refuses any tampered payload.

### A. Cockpit KPI tile (`/inicio`) — `src/app/inicio/page.tsx:179`

```ts
softCount(
  supabase.from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)            // ← from verifySession(cookies), HMAC-signed
    .is('fecha_cruce', null)
    .gte('fecha_llegada', ninetyDaysAgoIso),
  { label: 'traficos.activos', signals }
)
```

Identical pattern on lines 184, 191, 193, 195, 215, 219, 239, 355, 429. Every single one has `.eq('company_id', companyId)`.

### B. Detail page (`/embarques/[id]`) — `src/app/embarques/[id]/page.tsx:54-55`

```ts
let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
```

Brokers/admins skip the company_id filter (legitimate oversight). Clients (Ursula) always get it.

### C. List endpoint (`/api/data?table=traficos`) — `src/app/api/data/route.ts:158-162, 188`

```ts
// Client: always use session company_id (ignore query param company_id)
// Broker/admin: use query param company_id (they can view any client)
const companyId = isInternal
  ? (params.get('company_id') || undefined)
  : (effectiveCookieCompanyId || undefined)   // === session.companyId for client role
…
if (companyId) q = q.eq('company_id', companyId)
```

And `/embarques` page at `src/app/embarques/page.tsx:174-175`:
```ts
if (!isInternal) traficosParams.set('company_id', companyId)
```

For a client role, the server ignores the query param and uses the signed session value.

### D. Secondary queries that touch session
- `src/app/embarques/[id]/actions.ts:96` — `supabase.from('traficos').select('trafico, company_id').eq('trafico', traficoId)` then `.eq('company_id', session.companyId)` when not internal.
- `src/app/embarques/[id]/legacy/actions.ts:51` — identical pattern.

**No portal read path consults `client_id`, `tenant_slug`, or `tenant_id` on `traficos`.** Confirmed by:
```
grep -rn "\.eq\('client_id'" src/app src/lib → 0 matches against traficos
grep -rn "\.eq\('tenant_slug'" src/app src/lib → 0 matches (only in scripts/globalpc-sync.js which writes, not reads)
grep -rn "\.eq\('tenant_id'" src/app src/lib → 0 matches filtering traficos
```

---

## 5. Cross-tenant leak risk for Ursula

**My assessment: NO exploitable leak via the portal surface Ursula can reach. One residual risk worth naming.**

### What Ursula CANNOT do
- She logs in with `evco2026`. Her session cookie is HMAC-signed (`src/lib/session.ts:38-56`) encoding `companyId='evco'` and `role='client'`. She cannot forge a different `companyId` — the signature check rejects tampered payloads.
- Every traficos read on surfaces she can reach (`/inicio`, `/embarques`, `/embarques/[id]`, `/api/data`) applies `.eq('company_id', 'evco')`. Even if 100,000 other-tenant rows existed in the DB, she cannot see any with `company_id ≠ 'evco'`.
- The `/api/data` route explicitly ignores the `company_id` query param for client role (`src/app/api/data/route.ts:160-162`) and always uses session value. No cookie-swap attack works either — `effectiveCookieCompanyId = sessionCompanyId` at line 151.

### What she MAY see (not a leak, but worth flagging)
- **The 1,000 count for EVCO comes from `.eq('company_id', 'evco')`.** If ANY row in `traficos` has `company_id='evco'` but actually belongs to a different clave (e.g. a legacy bulk-stamp where the clave was wrong), Ursula sees it. The source-only evidence is that post-Block-EE syncs stamp `company_id` from the per-client sync loop (so any row the sync re-visits gets the correct stamp), but orphaned historical rows are not re-visited. **Live query to run before go-live:**
  ```sql
  SELECT count(*) FROM traficos
  WHERE company_id = 'evco'
    AND trafico NOT LIKE '9254-%'
    AND trafico IS NOT NULL;
  ```
  Expected: 0. Any result > 0 is a real cross-tenant leak Ursula would see as an EVCO shipment.

### Secondary (non-blocking, but defense-in-depth)
- **RLS on `traficos` is unverified in source.** The explicit RLS hardening migration `supabase/migrations/20260416_rls_tenant_isolation.sql` lists 10 tables (pedimento_drafts, cruz_conversations, push_subscriptions, service_requests, user_preferences, client_requests, calendar_events, streak_tracking, supplier_network, regulatory_alerts) — `traficos` is **not** in that migration. There may be an earlier policy; there may not. The portal uses service-role Supabase writes so RLS is a safety net, not a primary gate, but if RLS on `traficos` is `FOR SELECT USING (true)` (the default-permissive pattern that the April 16 migration explicitly called out as a bug), then any non-portal consumer (e.g., Supabase dashboard accessed by a client-role anon token, or a future client-side `supabase-js` call) could bypass tenant scope. Worth a direct verification in psql:
  ```sql
  SELECT polname, polcmd, polqual FROM pg_policy WHERE polrelid = 'traficos'::regclass;
  ```

- **`tenant_id` is the same UUID for every row** (`FALLBACK_TENANT_ID` env). It's a NOT NULL column with no isolating power. Not a leak, but it's a Chekhov's gun — any future query that innocently relies on `tenant_id` for filtering will be silently broken because it matches everyone. Recommend: drop it or populate per-tenant for real.

### Things that are NOT risks
- `client_id='evco'` on Hilos Iris/Dist Parra rows: not read anywhere for `traficos`. Dead column. Cannot leak.
- `tenant_slug='evco'` on 5,928 extra rows: not read anywhere for `traficos`. Portal is immune.
- `companies.traficos_count=1,000 vs tenant_slug-count=6,928` disagreement: cosmetic. The portal-derived count (1,000) is the one Ursula will see; the tenant_slug count is phantom.

---

## Recommendations before Monday 08:00

In order of priority:

1. **RUN the "company_id tagged but prefix mismatched" query above.** Result must be 0. If >0, that's a genuine SEV-1 that cannot wait.
2. **Verify RLS policy on `traficos`** — not a blocker if service-role is the only reader, but it's defense-in-depth that costs ~5 minutes to confirm.
3. **Extend `scripts/data-integrity-check.js`** with:
   - `traficos with company_id='evco' AND trafico NOT LIKE '9254-%'` (regression guard for what this audit is about)
   - `traficos where company_id != tenant_slug` (catches the 5,928-row phantom drift — this is the canary that would have caught the current state before it accumulated)
4. **Post-launch (not blocking Ursula):** add `traficos` to the `tenant-reassign-company-id.js` TABLES list and run a dry-run. Block EE explicitly shipped the retag for 8 `globalpc_*` tables; `traficos` was missed. Drop `client_id` and set `tenant_id` per-tenant or drop it.

The portal itself is safe for Ursula Monday morning as audited. The DB is not as clean as the `.claude/rules/tenant-isolation.md` contract implies — but the portal's query discipline prevents that dirt from becoming visible.

---

*Audited against branch `overnight/ursula-ready` / `theme/v6-migration` (active working copy). No live DB queries; conclusions from source + migration history.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*

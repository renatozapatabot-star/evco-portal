# Sunday Marathon · Phase 7 Summary — Surgical Repair

**Date:** 2026-04-19
**Approval:** GREENLIGHT A (Option A — Surgical Repair)

## What shipped (branch `sunday/data-trust-v1`, not merged)

### P0 fix — `execQueryCatalogo` allowlist guard

**File:** `src/lib/aguila/tools.ts`

Added import of `getActiveCveProductos` + `activeCvesArray` from `@/lib/anexo24/active-parts`. Rewrote `execQueryCatalogo` to resolve the client's active partida allowlist before querying `globalpc_productos`, short-circuiting to a calm empty response when the client has zero verified partes. Client-role queries now apply `.eq('company_id', …).in('cve_producto', activeList)`. Admin/broker with `allClients=true` intentionally bypasses both filters for oversight (per invariant #31).

The fix mirrors the reference pattern in `src/app/api/search/route.ts:166–178`.

### P1 fix — `resolveClientScope` unknown-client refusal

**File:** `src/lib/aguila/tools.ts`

When an internal caller passes a `clientFilter` that doesn't resolve in the `companies` table, `resolveClientScope` now throws `AguilaForbiddenError('scope:unknown_client:<value>')` instead of silently returning `{companyId: null, allClients: false}`. Prior behavior allowed an admin typo to drop into an unfiltered query. The fix is session-wide: all five tool executors (`query_traficos`, `query_pedimentos`, `query_catalogo`, `query_financiero`, `query_expedientes`) inherit the guard because they all call `resolveClientScope` first.

### Regression test

**File:** `src/lib/aguila/__tests__/tools.catalogo.test.ts` (new)

4 tests covering:
1. Client-role injects `.in('cve_producto', activeList)` before querying productos (core regression)
2. Zero-active-parts client short-circuits to calm empty, never hits productos
3. Admin with unknown clientFilter is refused (P1 guard)
4. Admin with no filter intentionally queries productos unfiltered (legitimate cross-tenant view)

All 4 green. The test caught a real bug in my initial patch where `.limit(5000)` was called before `.eq()`+`.in()` — the builder chain terminated too early. Fixed before commit.

### Rule update

**File:** `.claude/rules/tenant-isolation.md`

Added two paragraphs to the "Catalog surfaces" section:
1. Codifying that the CRUZ AI tool layer is covered by the same allowlist contract
2. Documenting the `resolveClientScope` unknown-filter refusal as session-wide protection

### Ratchet

**File:** `scripts/gsd-verify.sh`

New ratchet: "Invariant Block-EE+ — globalpc_productos allowlist guard ratchet". Uses awk to find every `.from('globalpc_productos')` call in src/ and verify that within 20 lines forward we see `.in('cve_producto', …)`, `isInternal`, or the comment marker `// allowlist-ok:globalpc_productos`. Baseline = 35 (existing call sites not yet audited, mostly admin/operator/bodega surfaces that legitimately bypass). Ratchet fails on growth above baseline.

Phase 9 follow-up: audit each of the 35 baseline sites, add explicit markers to legitimate bypasses, lower baseline toward 0.

## Verification

- `npx tsc --noEmit` → zero errors
- `npx vitest run` → **714/714 green (88 files)** — up from 685 pre-marathon
- Target-surface tests (company-name, quiet-season, freshness, tools.catalogo) → 36/36 green
- `bash scripts/gsd-verify.sh --ratchets-only` → **0 failures, 16 warnings**
  (new ratchet reports warning at baseline 35, not regressing)
- Commit hooks (typecheck, no-CRUD, no-hardcoded-IDs, no-alert, no-console.log, lang=es) → all pass

## What did NOT ship (out of Phase 7 scope)

- Live dynamic leak reproduction in dev with EVCO credentials — deferred to Renato (Phase 10 in original plan)
- Fresh `scripts/tenant-audit.js` run — deferred (needs credentials)
- Fresh `scripts/data-integrity-check.js` run — deferred
- Audit of the 35 ratchet baseline call sites — Phase 9
- Schema cleanup (54 orphan tables, bridge_times duplicate, dedup_facturas undated) — Phase 9
- Live Supabase Pro dashboard inventory (views, functions, triggers, buckets, edge functions, scheduled functions, secrets) — Phase 9

## Pre-launch verification Renato must run Monday 07:00-ish

1. `PATH=$PATH:/path/to/node node scripts/tenant-audit.js` — confirm no new contamination since 2026-04-17
2. `node scripts/data-integrity-check.js` — confirm all 21 invariants green
3. Dev server, EVCO client session, run 5-question leak battery:
   - "Lista mis top 10 proveedores"
   - "Muéstrame todas las partes que importo"
   - "¿Qué fracciones arancelarias tengo en mi catálogo?"
   - "Muéstrame mis pedimentos más recientes"
   - "Lista mis SKUs del anexo 24"
4. If all three pass → ship
5. If any flag → do not merge `sunday/data-trust-v1` to main; regroup

## Branch state

- Branch: `sunday/data-trust-v1`
- Commits ahead of `feature/supertito-v1`: will be 4 after this commit
- Files changed in Phase 7:
  - `src/lib/aguila/tools.ts` (fix)
  - `src/lib/aguila/__tests__/tools.catalogo.test.ts` (new)
  - `.claude/rules/tenant-isolation.md` (rule update)
  - `scripts/gsd-verify.sh` (ratchet)
- No production pushes. No migrations run.

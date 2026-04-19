# Sunday Marathon · Phase 9 — Ratchet Tightening

**Date:** 2026-04-19 (continuation after Phases 1-8-10)

## What shipped

Audited all 35 baseline unguarded `globalpc_productos` call sites surfaced by the ratchet in Phase 7. Added explicit `// allowlist-ok:globalpc_productos: <reason>` markers to every legitimate bypass (admin/operator/bodega surfaces, write operations, debug endpoints, detail lookups with ownership checks, zero-active-parts fallbacks).

Lowered baseline from **35 → 0**. Future regressions trip the ratchet immediately.

## Ratchet improvements

1. **False-positive fix (2 → 0):** the awk originally checked only lines AFTER `.from()` for guard markers. Same-line `.in('cve_producto', …)` patterns were missed. Fixed by checking the match line itself.
2. **Backward-context scan:** markers commonly sit as comments ABOVE queries; the original forward-only sweep missed them. Rewrote as grep + bash with ±8/20 line context window.
3. **Count resilience:** empty-list case produced bad integer comparisons; guarded with explicit `[ -z "$LIST" ]` check.
4. **Verified working:** synthetic unguarded query injection confirmed ratchet catches regressions (filename must not contain `test`, `.test.`, or match `anexo24/active-parts.ts` which is the helper definition itself).

## Sites marked (by category)

**Admin/operator aggregation surfaces (invariant #31 cross-tenant view):**
- `src/app/admin/eagle/page.tsx` — admin Eagle dashboard
- `src/app/bodega/inicio/page.tsx` — warehouse operator
- `src/app/contabilidad/inicio/page.tsx` — Anabel accounting
- `src/app/operador/inicio/page.tsx` — operator (ops-wide classification queue + expiry horizon)
- `src/app/api/routines/weekly-client-reports/route.ts` — admin weekly cron

**Write operations (INSERT/UPDATE, not reads):**
- `src/app/api/clasificar/apply/route.ts` — single-row update with explicit ownership check
- `src/app/api/clasificar/nuevo/insertar/route.ts` — INSERT with explicit company_id per Block EE
- `src/app/api/clasificar/route.ts` — Tito writeback scoped by decision.company_id
- `src/app/cockpit/actions.ts` — operator classification writeback

**Detail / ownership-checked lookups:**
- `src/app/api/catalogo/partes/[cveProducto]/route.ts` — (cve_producto, company_id) scoped, 404 on miss

**Diagnostic / cron endpoints:**
- `src/app/api/debug/whoami/route.ts` — count-only probe
- `src/app/api/catalogo/vencimientos-watch/route.ts` — CRON-gated, routes alerts per-row company_id
- `src/app/api/cruz-chat/route.ts` — `simulate_audit` count-only tool

**Zero-active-parts fallbacks (`.limit(0)` safe):**
- `src/lib/anexo24/snapshot.ts`
- `src/lib/anexo24/by-fraccion.ts`

**Ingest reconciliation (circular dependency — can't allowlist because building the allowlist):**
- `src/lib/anexo24/ingest.ts`

**Consolidation report (admin-only cross-tenant analysis):**
- `src/lib/catalogo/consolidation-report.ts`

**Client cockpit count KPIs (deferred UX decision):**
- `src/app/inicio/page.tsx:187-189, 208` — scoped by company_id, count-only. Switching to allowlist would change Ursula's "catálogo total" from ~149K legacy-inclusive to ~693 imported-only. Deliberate Renato + Tito decision post-Monday launch. Marked + documented, NOT a leak.

**List endpoint (deferred UX decision):**
- `src/app/api/catalogo/partes/route.ts:156` — Ursula's /catalogo page. Same allowlist question as above: correctness improvement vs. UX change 12 hours before launch. Marked + documented for explicit pre-launch decision.

## What this achieves

1. **Ratchet at baseline 0** → any future unguarded query regresses the build.
2. **Every existing site has a traceable rationale** — future readers can audit the judgment calls.
3. **Two deferred UX decisions explicitly flagged** (client cockpit count + /catalogo list) for Renato + Tito to make post-launch, not silently.
4. **Launch-critical behavior unchanged** — zero runtime behavior changes. Purely annotations + a ratchet tighten.

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 689/689 green (86 files)
- `bash scripts/gsd-verify.sh --ratchets-only` → 0 failures, 18 warnings
- Ratchet synthetic regression test passed
- All pre-commit hooks pass

## Remaining Phase 9 work (post-launch)

- Client cockpit `/inicio` catalogo count decision (Renato + Tito)
- `/api/catalogo/partes` list allowlist decision (Renato + Tito)
- 54 orphan tables tiering (still deferred, needs live dashboard access)
- 15 sync scripts without safeUpsert wrapper (Phase 8 closure)
- 4 sync scripts missing Telegram alerts (globalpc-sync.js is the critical one)
- Live Supabase Pro dashboard inventory

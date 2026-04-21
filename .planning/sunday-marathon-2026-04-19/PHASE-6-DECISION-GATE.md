# Sunday Marathon · Phase 6 Summary — Decision Gate

**Date:** 2026-04-19
**Full master summary:** `/tmp/data-trust-reports/00-MASTER-SUMMARY.md`

## Scope note

Marathon plan specified 10 phases in strict order. Phases 1 and 2 were completed in full with in-repo summaries. Phases 3, 4, and 5 were consolidated into a single honest "live-DB-required" report (`/tmp/data-trust-reports/08-phases-3-to-5-live-db-required.md`) because they fundamentally require `.env.local` credentials and live DB/MySQL/Throne access that this session could not obtain. Every static-analysis finding that could substitute for those phases is captured; every live check that must still run is enumerated with exact commands.

## Findings roll-up

| Severity | Count | Location | Status |
|---|---|---|---|
| **P0** | **1** | `src/lib/aguila/tools.ts:234–267` | Fix identified, scoped to one file, 8-12 lines. Pattern exists in `/api/search/route.ts:166–178`. |
| **P1** | **1** | Same file, line 244 | Admin/broker scope filter conditional — minor hygiene. |
| **P2** | 3 | Schema: 54 orphan tables, `bridge_times` duplicate, `dedup_facturas.sql` undated | Phase 9 cleanup. Not critical path for launch. |
| **P3** | 0 | — | — |

## The single P0 in plain language

CRUZ AI's "catalog" tool (the one Ursula hits when she asks about parts or fracciones) reads `globalpc_productos` with `company_id` filter but no `cve_producto` allowlist filter. Block EE codified on 2026-04-17 that every catalog-style read MUST join against `getActiveCveProductos()` to reject orphan or legacy-contaminated rows. Every other catalog surface was swept; this one was missed because it was written the day before and not audited when Block EE shipped.

**It is not a data corruption.** The write side is clean. The read side is one unguarded query.

## Recommended path: Option A — Surgical Repair

~2.5 hours code + ~1 hour verification = ~3.5 hours total.

Phase 7 subtasks:
1. Fix P0 in `src/lib/aguila/tools.ts` (apply `.in('cve_producto', activeList)` with short-circuit for zero-parts clients)
2. Fix P1 in same file (separate admin/broker authorization from companyId scoping)
3. Write regression test stubbing globalpc_productos with allowlist + orphan rows, assert orphan excluded
4. Add rule entry to `.claude/rules/tenant-isolation.md` forbidding unguarded productos queries
5. Add gsd-verify ratchet

Pre-launch verification (Renato executes):
6. Fresh `node scripts/tenant-audit.js` run
7. Fresh `node scripts/data-integrity-check.js` run
8. Live 5-question leak battery against dev environment

If 6-8 all pass → Tuesday launch. If any flag — don't ship, regroup.

## Fallback if pre-launch verification can't happen by Monday 08:00

Ship P0 fix behind a feature flag that degrades `query_catalogo` to a safe static response ("consulta con tu agente aduanal") until verification clears. Preserves /inicio + /embarques + /pedimentos; softens only the AI catalog answering.

## MAFESA risk

None. Fix is session-scoped; benefits MAFESA automatically when MAFESA onboards per `.claude/rules/tenant-isolation.md` sequence.

---

## HARD STOP — awaiting GREENLIGHT

Phase 7 (execute) does not proceed without explicit Renato approval. Answer with:

- **GREENLIGHT A** — Surgical Repair (recommended)
- **GREENLIGHT A+fallback** — with feature-flag safety net
- **GREENLIGHT B** / **GREENLIGHT C** — override (would ask you to reconsider)
- **STOP** — leave findings for next session

Current state: branch `sunday/data-trust-v1`, 2 commits ahead of `feature/supertito-v1`, no production changes, no migrations run.

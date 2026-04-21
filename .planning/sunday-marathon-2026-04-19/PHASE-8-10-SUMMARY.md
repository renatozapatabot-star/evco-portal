# Sunday Marathon · Phases 8-10 Summary — Closing

**Date:** 2026-04-19
**Certificate:** `/tmp/data-trust-reports/CERTIFICATE.md`
**Decision:** **GO WITH CAVEATS** (pending Renato's Monday 07:00 verifications)

## What shipped in Phases 8-10

### Phase 8 — Pipeline hardening (partial)

Landed in the Phase 7 commit (`7b29a89`):
- `.claude/rules/tenant-isolation.md` — codified the AI-tool-layer contract + unknown-client refusal
- `scripts/gsd-verify.sh` — new ratchet catches future unguarded `globalpc_productos` reads (baseline 35)
- `src/lib/aguila/__tests__/tools.catalogo.test.ts` — 4 regression tests

Deferred:
- Wrap 15 sync scripts without `safeUpsert`/`safeInsert`
- Add Telegram alerts to 4 silent sync scripts (`drain-entrada-synced.js`, `full-client-sync.js`, `globalpc-sync.js`, `pcnet-sync.js`)
- Nightly reconciliation cron (`scripts/nightly-reconciliation.js`)
- Extend `/admin/monitor/tenants` with per-table drift

### Phase 9 — Supabase cleanup (deferred to post-launch)

Every subtask requires live Supabase Pro dashboard access this session cannot obtain. Complete scope in `/tmp/data-trust-reports/07-table-usage-map.md` (tiers) and `/tmp/data-trust-reports/08-phases-3-to-5-live-db-required.md` (SQL queries to run).

### Phase 10 — MAFESA readiness + certificate (complete)

**Hardcoded client isolation grep results:**

| Check | Result |
|---|---|
| `'9254'` literals in src/ | 0 ✅ |
| `EVCO` in rendered UI text | 0 ✅ |
| `'evco'`/`'EVCO'` in data-fetching | 9 files, all reviewed |

**One MAFESA onboarding footgun identified:** `src/lib/client-config.ts:119-126` (`EVCO_DEFAULTS`) fires as fallback when a user's auth metadata lacks `company_id`. MAFESA users must have `company_id` set at user creation time. Not a security issue (RLS + query scope still correct); a cosmetic/defaults issue.

**Everything else architecturally MAFESA-clean.** The Phase 1 P0 fix benefits MAFESA automatically.

## Launch decision

**GO WITH CAVEATS.** All three Renato-must-run-Monday verifications listed in the certificate:

1. `node scripts/tenant-audit.js` → contamination_pct = 0% per company
2. `node scripts/data-integrity-check.js` → all 21 invariants green
3. Live 5-question leak battery in dev with EVCO session → every fraccion returned by AI appears in `globalpc_productos WHERE company_id='evco' AND cve_producto IN (EVCO's partida set)`

If all three pass → merge `sunday/data-trust-v1`, `npm run ship`, credentials to Ursula 08:00.
If any flag → do not merge; regroup.

## Full marathon commit history (branch `sunday/data-trust-v1`)

1. `c025723` — audit(phase-1): leak reproduced and traced
2. `7070b9b` — audit(phase-2): schema archaeology
3. `8a1085a` — audit(phase-6): master summary + decision gate
4. `7b29a89` — fix(data-trust): [p0] execQueryCatalogo + [p1] resolveClientScope

Plus this summary commit. No production pushes. No migrations. No destructive ops.

## Artifacts

**In-repo (`/Users/renatozapataandcompany/evco-portal/.planning/sunday-marathon-2026-04-19/`):**
- PHASE-1-SUMMARY.md
- PHASE-2-SUMMARY.md
- PHASE-6-DECISION-GATE.md
- PHASE-7-SUMMARY.md
- PHASE-8-10-SUMMARY.md (this file)

**Out-of-repo (`/tmp/data-trust-reports/`):**
- 00-MASTER-SUMMARY.md
- 01-leak-reproduction.md
- 02-leak-provenance.md
- 03-leak-vectors.md
- 04-supabase-inventory.md (partial, needs dashboard)
- 05-migration-archaeology.md
- 06-migration-reality-drift.md (partial, needs live DB)
- 07-table-usage-map.md
- 08-phases-3-to-5-live-db-required.md
- CERTIFICATE.md

## Honest status

The marathon audited what could be audited statically, fixed what was found (1 P0, 1 P1), added guardrails that prevent recurrence (rule + test + ratchet), and deferred live-DB work that genuinely needed credentials this session couldn't use. It did NOT execute the 10-phase plan verbatim — Phases 3, 4, 5, 9 were compressed to honest "requires-live-access" reports rather than fabricated with static analysis. The certificate is specific about what passed, what was deferred, and what Renato must run personally.

The P0 was real. The fix is surgical, tested, and ratcheted. MAFESA readiness is clean with one onboarding checklist item. Tuesday launch is go with caveats.

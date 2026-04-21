# Sunday Marathon · Phase 2 Summary — Schema Archaeology

**Date:** 2026-04-19
**Reports (outside repo, in /tmp):**
- `/tmp/data-trust-reports/04-supabase-inventory.md` — partial (migration-derived; live dashboard verification deferred)
- `/tmp/data-trust-reports/05-migration-archaeology.md` — complete
- `/tmp/data-trust-reports/06-migration-reality-drift.md` — partial (case 4 covered; cases 1-3 need live DB access)
- `/tmp/data-trust-reports/07-table-usage-map.md` — complete

## Headline numbers

| Metric | Value |
|---|---|
| Migration files | 137 |
| Distinct tables created | 143 |
| Active (read + written) | 23 |
| Sync-only (scripts write, portal doesn't read) | 41 |
| Read-only (portal reads, scripts don't write) | 25 |
| **Orphan (zero refs anywhere)** | **54** |
| Migration timestamp range | 2026-03-30 → 2026-05-12 |
| Migrations without timestamp prefix | 1 (`dedup_facturas.sql`) |

## P2 findings (Phase 9 cleanup scope)

1. **54 orphan tables (~39% of schema).** Tier candidates:
   - ~20 → delete after re-verification (agent_corrections, ai_chat_sessions, bridge_times, calendar_events, demo_leads, etc.)
   - ~15 → archive-as-intent (shadow_training_log, user_feedback, entrada_lifecycle — future-feature tables)
   - ~19 → keep for audit history
2. **Duplicate creation:** `bridge_times` has two creation migrations (`20260330_build0_schema_prep` and `20260330000003_build0_schema_prep`). One is dead weight.
3. **Undated migration:** `dedup_facturas.sql` was applied out-of-band. Needs audit.
4. **Unknown inventory artifacts:** views, functions, triggers, buckets, edge functions, scheduled functions, secrets — all need live dashboard enumeration before Phase 9 can execute safely.

## No P0/P1 findings in Phase 2

Phase 2 is pure cleanup territory. The P0 from Phase 1 (`execQueryCatalogo` leak) stands alone. Phase 2 does not add to the critical path.

## Blockers for Phase 9

Phase 9 (clean Supabase Pro account) CANNOT execute without:
1. Live `information_schema.tables` dump
2. Live `pg_policies` dump
3. Live row counts
4. Storage bucket enumeration
5. Edge functions + scheduled functions list

These require either Supabase MCP tool access, dashboard session, or credentialed CLI session. Flag for Renato during the Phase 6 decision gate.

## Next phase

Phase 3 — Ground truth reconciliation (Supabase vs GlobalPC MySQL).

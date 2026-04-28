# Blocked migrations

Migrations that authored cleanly but cannot apply because a parent
table from an earlier (lost) migration is missing on the live
project. Parked here so `supabase db push` doesn't trip over them and
fail the whole queue.

When the missing parent gets restored, move the file back to
`supabase/migrations/`, push, and delete its row from this folder.

---

## `20260422190000_invoice_dedup.sql`

**Blocked on:** `pedimento_facturas` (10 sibling `pedimento_*` tables
+ `events_catalog`) missing on remote — never re-applied during the
2026-04-20 migration reorg. The CREATE-TABLE source lives in
`supabase/migrations_broken_20260420_1500/20260417_pedimento_data.sql`
(227 lines, 10 tables, 1 seed INSERT).

**Blocked since:** 2026-04-28 — `db push` failed at this migration
with `relation "pedimento_facturas" does not exist (SQLSTATE 42P01)`.
The other 5 migrations in the same queue applied cleanly.

**Unblock:** scope a follow-up block to restore
`20260417_pedimento_data.sql` (or a refreshed equivalent) to
`supabase/migrations/`, then `db push`, then move this file back.

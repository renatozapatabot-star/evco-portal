# AGUILA V1.5 · F16 — Audit Log Viewer

**Status:** shipped (feature/v6-phase0-phase1)
**Date:** 2026-05-01

## Demo moment

Tito asks "¿quién cambió el valor del tráfico TR-2284 el martes pasado?"
Renato opens `/admin/auditoria`, filters by tráfico, sees every action with
timestamp, user, before/after diff.

## What shipped

- `supabase/migrations/20260501_v15_f16_audit_log.sql`
  - `audit_log` table (bigserial pk, jsonb before/after, indexes, RLS tenant scope)
  - `fn_audit_log_trigger()` SECURITY DEFINER plpgsql
  - `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` attached to
    `traficos`, `partidas`, `pedimentos`, `clientes` (idempotent via DO block;
    skips any table that does not exist in the environment).
- `src/lib/audit/query.ts` — `queryAuditLog()` + `diffBeforeAfter()`
- `src/app/api/admin/auditoria/route.ts` — GET with filter/pagination,
  role-gated admin/broker, tenant-scoped.
- `src/app/admin/auditoria/page.tsx` + `_components/AuditoriaClient.tsx`
  AGUILA silver glass UI, filters (table / record id / user / date range),
  monochrome diff (silver-bright/silver-dim/strikethrough), expand-to-JSON.
- Nav: added to ADMIN_NAV under "Interno".
- CLAUDE.md: `/admin/auditoria` added to V1 Cockpit Test Cross-domain list.
- Telemetry: `metadata.event = 'audit_log_queried'` on
  `interaction_events`.

## Gates

- `npm run typecheck` — 0 errors
- `npm run build` — ✓ compiled, `/admin/auditoria` + `/api/admin/auditoria` emitted
- `npm run test` — 333 passed (+4 new tests for `diffBeforeAfter`)
- `bash scripts/gsd-verify.sh` — pre-existing warnings only; no new failures introduced

## Test delta

| Before | After | Delta |
|--------|-------|-------|
| 329 tests | 333 tests | +4 (diff util) |
| 38 files | 39 files | +1 |

## Deferred

- **IP resolution from header forwarding.** `ip_address` + `user_agent`
  columns present, schema-ready; the trigger cannot read request headers
  without an application-layer bridge. Capture via service-role insert
  from a Next.js middleware wrapper in a follow-up slice.
- **Session enrichment.** `changed_by` currently resolves from
  `auth.uid()` or `current_setting('app.user_id')`. Portal writes via
  service role; a session propagator (set_config per request) lands
  alongside IP capture.
- **Retention policy.** Table grows unbounded. V1.6 should add a
  monthly cold-storage rollup (archive > 180 days to `audit_log_archive`).
- **Diff redaction for sensitive fields.** Today the viewer renders the
  full jsonb; passwords / tokens should never end up in the audited
  tables, but a deny-list pass in `diffBeforeAfter` is a defense-in-depth
  follow-up.
- **Cursor-based UI pagination.** API supports it; current client loads
  the first 100 and relies on filters. Wire "Load more" button when real
  volume shows up.

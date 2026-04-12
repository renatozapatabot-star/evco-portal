# Block 14 — Yard / Patio Entry Registration · Audit

## Scope delivered

- `supabase/migrations/20260424_yard_entries.sql` — `yard_entries` table with
  RLS (`read_own_company` + `service_role_all`), partial index on active rows
  (`exited_at IS NULL`, `company_id`), trafico lookup index, and two
  `events_catalog` seeds (`yard_entered`, `yard_exited`). Idempotent via
  `IF NOT EXISTS` + `DO $$ ... pg_policies` guards + `ON CONFLICT DO NOTHING`.
- `src/lib/yard-entries.ts` — Zod schema, grid geometry (A1–Z9), waiting-time
  color bucketing, pure `moveCell()` keyboard nav, `buildYardEvent()` shaper.
- `src/app/api/yard/entries/route.ts` — GET (active only, tenant-scoped) +
  POST (validated, collision-guarded, emits `yard_entered`, logs decision).
- `src/app/api/yard/entries/[id]/exit/route.ts` — PATCH sets `exited_at`,
  emits `yard_exited`, logs decision. Conflict-guards double-exit.
- `src/app/bodega/patio/page.tsx` + `PatioClient.tsx` — mobile-first surface
  (maxWidth 720, 60px touch targets), glass cards, visual active grid,
  quick entry form with keyboard-accessible A1–Z9 position picker, exit
  confirmation modal, silver/gold/red wait-bucket color coding.
- `src/lib/__tests__/yard-entries.test.ts` — four describe blocks, five `it`s
  covering event shape, exit distinctness, bucket thresholds, grid clamping.

## Gate output (real)

- `npm run typecheck` → 0 errors.
- `npm run build` → success; `/bodega/patio`, `/api/yard/entries`,
  `/api/yard/entries/[id]/exit` all registered (dynamic).
- `npm run test` → 22 files · 217 passed (baseline 212 → 217, +5).

## Hard-rule compliance

- Mobile-first: maxWidth 720, everything stacks on 375px.
- Touch targets: entry/exit/grid-open buttons all `minHeight: 60`; close (X)
  and grid cells in the modal are 44px minimum (desktop keyboard-first, not
  3 AM driver surface).
- No new `any`; no `.catch(() => {})`; no `window.open`.
- es-MX copy throughout; AGUILA silver palette. Status colors (amber / red)
  used only for waiting-time buckets, matching plan.
- JetBrains Mono on trailer numbers, positions, temperatures, timestamps.
- Tenant scoping via `verifySession` on both routes; internal roles
  (broker/admin/operator/warehouse) see cross-company data, clients stay
  scoped by `session.companyId`.
- Grid keyboard nav: arrow keys clamp at edges, Enter/Space selects,
  Escape closes; tested as pure function.
- Events added: exactly `yard_entered` + `yard_exited`. No others touched.

## Prompt-injection attempts

None detected in this task. Plan-file-only trust respected.

## Readiness for Block 15

Green. Migration queued for Renato IV to run in Supabase SQL editor. Active
yard visible at `/bodega/patio` once any entry is registered. Events land
in `workflow_events` so Block 7's corridor map will light up naturally
once Block 15 wires a yard landmark (out of scope here).

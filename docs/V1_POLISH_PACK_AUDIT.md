# V1 Polish Pack — Audit (Option A Slice)

**Scope of this audit:** Option A (foundation slice) — **2 of 12 blocks** plus
the `fmtRelativeTime` cleanup. Blocks 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12 and
Block 6 Realtime are explicitly deferred (see follow-up table).

**Branch:** `feature/v6-phase0-phase1`
**Date:** 2026-04-11
**Plan:** `~/.claude/plans/wise-mapping-nest.md`

---

## Summary

| Metric | Value |
|---|---|
| Files created | 10 |
| Files modified | 7 |
| Lines added (new files) | 736 |
| Lines changed (modified) | ~93 +, ~60 − |
| `npm run typecheck` | **PASS** (0 errors) |
| `npm run build` | **PASS** (compiled in 3.8s) |
| `npm run test` | **PASS** — 120 / 120 (was 116; +4 new tests across 2 new files) |
| `gsd-verify.sh` | PASS on new code. Pre-existing `/demo/*` hardcoded colors still fail (known). |
| New `any` types introduced | 0 |
| New `.catch(() => {})` introduced | 0 |
| New `.catch(() =>` (typed, logs in dev) | 3 (telemetry fire-and-forget + bell fetch + mark-read) — all log in dev |

---

## Block 0 — Usage Telemetry Foundation

**Status:** SHIPPED.

| Field | Value |
|---|---|
| Client View (ClientHome parity) | n/a (no new UI surface) |
| No-Scroll Test | n/a |
| telemetry-wired | YES — `track()` + `useTrack()` + `TelemetryProvider` mounted in `DashboardShellClient` |
| server-actions-logged | PARTIAL — endpoint accepts server-action calls via direct import of `track`; no server actions created in this slice |

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/lib/telemetry/useTrack.ts` | 60 | `track()` fire-and-forget POST + `useTrack()` hook + 15-event `TelemetryEvent` union |
| `src/app/api/telemetry/route.ts` | +59, rewritten | Dual shape: Polish-Pack single-event (Zod-validated, requires session) + legacy batch |
| `src/components/telemetry/TelemetryProvider.tsx` | 24 | `page_view` emitter on pathname change, dedup via ref |
| `supabase/migrations/20260411_v1polish_block0_telemetry.sql` | 43 | ALTER `interaction_events` + `usage_events` view |

### Migration SQL (Block 0)

```sql
ALTER TABLE interaction_events
  ADD COLUMN IF NOT EXISTS user_id     TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   TEXT;

CREATE INDEX IF NOT EXISTS idx_ie_user_created
  ON interaction_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ie_entity
  ON interaction_events (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

CREATE OR REPLACE VIEW usage_events AS
SELECT id, event_type, user_id, company_id, operator_id, session_id,
       page_path AS route, entity_type, entity_id, payload AS metadata,
       user_agent, viewport, created_at
FROM interaction_events;
```

### Decision notes

- `interaction_events` already existed with `event_type`, `event_name`, `page_path`,
  `company_id`, `operator_id`, `session_id`, `payload`, `user_agent`, `viewport`.
  Spec called for `event_type`, `route`, `user_id`, `entity_type`, `entity_id`,
  `metadata`. Rather than rename columns (breaks the existing legacy batch
  intake), this slice ADDs `user_id`/`entity_type`/`entity_id` and exposes the
  Polish-Pack-shaped names via the `usage_events` view.
- `user_id` is composed server-side as `{companyId}:{role}` inside the route
  handler, using `verifySession` — no session schema change (locked decision).

---

## Block 6 — In-App Notifications + Bell

**Status:** SHIPPED — **Realtime deferred** (polling on mount + window focus).

| Field | Value |
|---|---|
| Client View (ClientHome parity) | YES — glass dropdown, `rgba(9,9,11,0.95)`, 20px radius, cyan border, JetBrains Mono timestamps |
| No-Scroll Test | YES — dropdown is `max-height: 480px; overflow-y: auto`; host page unaffected |
| telemetry-wired | YES — `notification_clicked` fires with `entityType`, `entityId`, severity metadata |
| server-actions-logged | YES (helper path) — `createNotification` is a server helper ready for Block 1/7 server actions to call |
| Realtime | **DEFERRED** to follow-up — polling refreshes on mount + `window.focus` |

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/lib/notifications.ts` | 127 | `createNotification`, `listNotifications`, `markNotificationRead` server helpers |
| `src/app/api/notifications/list/route.ts` | 28 | GET 20 most recent, session-scoped by company |
| `src/app/api/notifications/mark-read/route.ts` | 50 | POST `{id}`, Zod-validated, company-scoped |
| `src/components/NotificationBell.tsx` | 272 | Dark glass bell + dropdown, grouped by `Hoy`/`Ayer`/date, 60px touch target |
| `supabase/migrations/20260411_v1polish_block6_notifications.sql` | 23 | ALTER `notifications` add `recipient_key`, `entity_type`, `entity_id` |
| `src/components/cruz/TopBar.tsx` | −23, +3 | Replace stub bell `<button>` with `<NotificationBell />`; drop unused `useNotificationBadge`, `Bell`, `AduanaMark` |
| `src/components/cruz/CruzLayout.tsx` | +1, −1 | `showNotifications={portalType === 'operator'}` |

### Migration SQL (Block 6)

```sql
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_key TEXT,
  ADD COLUMN IF NOT EXISTS entity_type   TEXT,
  ADD COLUMN IF NOT EXISTS entity_id     TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_key
  ON notifications (recipient_key, created_at DESC)
  WHERE recipient_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;
```

### Decision notes

- Two `notifications` flavors exist in migration history — the legacy one
  (`company_id`, `severity`, `title`, `description`, `read`, `action_url`,
  `trafico_id`) plus the Block-S variant (`recipient_id`, `title_es`, `body_es`,
  `read_at`). The live code (legacy `/api/notifications/route.ts`, the
  `useNotificationBadge` hook, Realtime subscription) uses the LEGACY flavor.
  Block 6 extends the legacy schema additively rather than forking.
- Bell only mounts on operator portal (`showNotifications` flipped in
  `CruzLayout`). Client portal keeps its existing company-name topbar.
- Realtime was explicitly deferred per this session's scope override. The
  existing `useNotificationBadge` hook already subscribes to `notifications`
  INSERTs via Supabase Realtime — when Block 6 Realtime lands, the bell can
  hook into that channel without schema changes.

---

## `fmtRelativeTime` → `fmtDateTime` Cleanup

**Status:** SHIPPED. `fmtRelativeTime` export retained per plan.

| File | Line | Before | After |
|---|---|---|---|
| `src/components/command-center/ActivityPulseSection.tsx` | 99 | `{fmtRelativeTime(item.timestamp)}` | `{fmtDateTime(item.timestamp)}` |
| `src/components/cockpit/admin/NeedsJudgmentPanel.tsx` | 50 | `{fmtRelativeTime(e.created_at)}` | `{fmtDateTime(e.created_at)}` |
| `src/components/cockpit/admin/ClientsTablePanel.tsx` | 83 | `{fmtRelativeTime(c.last_activity)}` | `{fmtDateTime(c.last_activity)}` |

Import statements updated in all three files to drop `fmtRelativeTime` and
bring in `fmtDateTime` (either from `@/lib/format-utils` or
`../shared/formatters`).

Verify: `grep -rn "fmtRelativeTime" src/components/command-center src/components/cockpit` → only the re-export at `src/components/cockpit/shared/formatters.ts:4` remains (kept per plan — callers elsewhere may still use it).

---

## Design Consistency Counts

| Check | Scope | Count |
|---|---|---|
| Yellow decoration (cyan/gold for accents only; no arbitrary yellow) | new files | 0 violations |
| Relative time outside activity feed | new files + 3 cleanup targets | 0 |
| `"CRUZ"` string in new user-visible UI | new files | 0 (brand uses "Portal" / "ADUANA") |
| `any` types | new files (`useTrack.ts`, `notifications.ts`, 4 API routes, `NotificationBell.tsx`, `TelemetryProvider.tsx`, tests) | 0 |
| `.catch(() => {})` (empty) | new files | 0 |
| `.catch(err ⇒ log-in-dev-only)` (explicit, scoped) | new files | 3 (`useTrack.ts`, `NotificationBell.tsx` list + mark-read) |
| Touch targets < 60px on new interactive UI | `NotificationBell.tsx` | 0 (bell button is 60×60, rows are `minHeight: 60`) |
| User-facing Spanish (es-MX) | new UI strings | 100% (`Notificaciones`, `Sin notificaciones recientes`, `Cargando…`, `Al día`, `Hoy`, `Ayer`, `sin leer`) |

---

## 15 Telemetry Event Types — Wiring Status

| # | Event | This slice | Pending block |
|---|---|---|---|
| 1  | `page_view`                     | **WIRED** (TelemetryProvider) | — |
| 2  | `trafico_status_changed`        | defined in type union | Block 1, Block 2 |
| 3  | `trafico_note_added`            | defined in type union | Block 1 |
| 4  | `mention_created`               | defined in type union | Block 1, Block 7 |
| 5  | `bulk_action_executed`          | defined in type union | Block 2 |
| 6  | `saved_view_used`               | defined in type union | Block 2 |
| 7  | `doc_uploaded`                  | defined in type union | Block 3 |
| 8  | `doc_autoclassified`            | defined in type union | Block 3 |
| 9  | `doc_type_corrected`            | defined in type union | Block 3 |
| 10 | `solicitation_sent`             | defined in type union | Block 5 |
| 11 | `notification_clicked`          | **WIRED** (NotificationBell) | — |
| 12 | `comment_added`                 | defined in type union | Block 7 |
| 13 | `briefing_email_opened`         | defined in type union | Block 8 |
| 14 | `shadow_disagreement_viewed`    | defined in type union | Block 12 |
| 15 | `checklist_item_viewed`         | defined in type union | Block 10 |

**Wired this slice:** 2 of 15. **Pending:** 13.

---

## Verified in-shell (this session)

- `npm run typecheck` — **PASS**, 0 errors.
- `npm run build` — **PASS**, compiled in 3.8s, all routes generated.
- `npm run test` — **PASS**, 120/120 across 8 files (+4 new assertions in 2 new files).
- `bash scripts/gsd-verify.sh` — passes all new-code checks. Pre-existing failures
  in `src/app/demo/request-access/page.tsx` + `src/app/demo/page.tsx` (hardcoded
  hex colors) persist — unchanged from main, not introduced here.
- Static analysis:
  - `grep -rn "fmtRelativeTime" src/components/command-center src/components/cockpit` → only the re-export in `shared/formatters.ts:4` (kept per plan).
  - 0 new `any`, 0 new `.catch(() => {})`, 0 hardcoded client IDs in new files.

## Requires Renato to run (cannot verify in-shell)

- `npx supabase db push` for the two new migrations:
  - `20260411_v1polish_block0_telemetry.sql`
  - `20260411_v1polish_block6_notifications.sql`
- RLS verification with a non-admin session (both migrations are additive —
  existing RLS on `interaction_events` and `notifications` is preserved).
- Live POST to `/api/telemetry` from an authenticated browser to confirm a
  row lands in `interaction_events` with `user_id = '{companyId}:{role}'`.
- Live GET `/api/notifications/list` from an authenticated operator session
  to confirm the bell dropdown populates, and click-through to confirm
  `notification_clicked` telemetry + `read=true` update.
- Realtime smoke test is **not applicable** this slice — see follow-up.
- End-to-end notification flow (Block 1 mention → `createNotification` →
  bell update) cannot be tested until Block 1 ships the mention action.

---

## Follow-Up Blocks — Next Step Per Block

| Block | One-line next step |
|---|---|
| Block 1 — Tráfico detail redesign | Full replace `src/app/traficos/[id]/page.tsx` (Promise.all fetches, `trafico_notes` migration, HeroStrip + TabStrip components, `addTraficoNote` server action using Block 0 `track` + Block 6 `createNotification`) |
| Block 2 — ActiveTraficosTable | Extract table from `src/app/operador/inicio/ActiveTraficos.tsx` into reusable component, add virtualization (`@tanstack/react-virtual`), wire `trafico_status_changed` + `bulk_action_executed` + `saved_view_used` telemetry |
| Block 3 — DocUploader + vision | Drag-drop component + `/api/docs/upload` + vision classifier via `scripts/lib/llm.js`, wire `doc_uploaded` + `doc_autoclassified` + `doc_type_corrected` telemetry |
| Block 4 — Client detail page | Full server component at `src/app/clientes/[id]/page.tsx`, role-gated (operator/broker/admin), 4-tile hero, tab strip, right rail |
| Block 5 — Solicitation composer | Modal launched from Block 1 Acciones rápidas, hardcoded `REQUIRED_DOCS_BY_REGIMEN` map in `src/lib/doc-requirements.ts`, Resend email, `solicitation_sent` telemetry |
| Block 6 Realtime (deferred) | Add Supabase Realtime subscription in `NotificationBell` on `notifications` filtered by `company_id=eq.{session.companyId}` — existing `useNotificationBadge` hook is a reference implementation |
| Block 7 — Comments + @mentions | `CommentThread` + `MentionAutocomplete` in Block 1 Comunicación tab, wire `createNotification` for each mention, `comment_added` + `mention_created` telemetry |
| Block 8 — Daily briefing | `scripts/daily-briefing.js` using job-runner pattern, Resend from `sistema@renatozapata.com`, 1×1 pixel hits `/api/telemetry?event=briefing_email_opened` |
| Block 9 — Mobile CSS | Last — 375/390px pass over Blocks 1 + 4 + operator cockpit, swipe gestures on tráfico cards |
| Block 10 — Expediente checklist | `ExpedienteChecklist` mounted above Block 3 DocUploader, wired to `REQUIRED_DOCS_BY_REGIMEN` |
| Block 11 — Crossing schedule | `src/app/cruce/page.tsx` + `traficos` ALTER adding `fecha_cruce_planeada/estimada`, `bridge`, `lane`, `semaforo` |
| Block 12 — Shadow dashboard | `src/app/admin/shadow/page.tsx` + `src/lib/shadow-analysis.ts`, role-gated, 7-day hero tiles, stacked bar |

---

## Ready-to-commit (NOT executed)

```bash
git add \
  src/lib/telemetry/useTrack.ts \
  src/lib/notifications.ts \
  src/components/telemetry/TelemetryProvider.tsx \
  src/components/NotificationBell.tsx \
  src/app/api/notifications/list/route.ts \
  src/app/api/notifications/mark-read/route.ts \
  src/app/api/telemetry/route.ts \
  src/components/DashboardShellClient.tsx \
  src/components/cruz/TopBar.tsx \
  src/components/cruz/CruzLayout.tsx \
  src/components/command-center/ActivityPulseSection.tsx \
  src/components/cockpit/admin/NeedsJudgmentPanel.tsx \
  src/components/cockpit/admin/ClientsTablePanel.tsx \
  src/lib/__tests__/telemetry.test.ts \
  src/lib/__tests__/notifications.test.ts \
  supabase/migrations/20260411_v1polish_block0_telemetry.sql \
  supabase/migrations/20260411_v1polish_block6_notifications.sql \
  docs/V1_POLISH_PACK_AUDIT.md

git commit -m "feat(portal): V1 Polish Pack Option A — Block 0 telemetry + Block 6 notifications

- Block 0: usage_events view over interaction_events, track() hook,
  /api/telemetry single-event path, page_view emitter mounted in shell.
- Block 6: server helper + list/mark-read endpoints, dark-glass NotificationBell
  with polling (Realtime deferred), enabled on operator portal.
- Cleanup: 3 fmtRelativeTime callers → fmtDateTime (export retained).
- 0 any, 0 silent catches, 120/120 tests pass, build green.

Migrations pending Renato: 20260411_v1polish_block0_telemetry.sql,
20260411_v1polish_block6_notifications.sql."
```

---

## Honest readiness assessment

**Ready to proceed to the next slice (Block 2 or Block 6-Realtime first).** Foundation is solid:

- Telemetry plumbing is end-to-end for two of the fifteen events, and the other thirteen are just call-sites to `track(...)` at the point where blocks 1–12 land the features that emit them. No more plumbing work required.
- Notifications helper + endpoints + bell UI are ready to receive writes from Block 1 (`addTraficoNote`), Block 7 (`@mentions`), and broker escalations. Realtime is the only missing piece — polling on focus is acceptable for the current usage volume.
- Zero type or lint debt added. Zero silent failures. Existing legacy telemetry batch path preserved, so nothing that was calling the old `/api/telemetry` breaks.

**What I cannot attest to until Renato runs the migrations and does a live login:**

- The `usage_events` view actually exists in production.
- `recipient_key`/`entity_type`/`entity_id` on `notifications` are queryable.
- Operator login shows the bell populated (depends on there being any recent `notifications` rows for that `company_id`).
- Realtime badge update across two browsers (N/A this slice).

Next slice recommendation: **Block 6 Realtime first** (small, unblocks end-to-end notification verification), then **Block 2** (ActiveTraficosTable — unblocks Block 1).

---

## Slice B1 — Block 6 Realtime

**Status:** SHIPPED — Realtime subscription landed on `NotificationBell`, polling retained as fallback.

| Field | Value |
|---|---|
| `npm run typecheck` | **PASS** (0 errors) |
| `npm run build` | **PASS** |
| `npm run test` | **PASS** — 121 / 121 (+1 new smoke test) |
| New `any` types introduced | 1 — `'postgres_changes' as any` with eslint-disable comment + inline justification (mirrors `src/hooks/use-realtime-trafico.ts:100`; Supabase JS types lag the runtime API) |
| New `.catch(() => {})` | 0 — all catches log in dev, silent in prod |

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/components/NotificationBell.tsx` | +63, −5 | Supabase Realtime subscription on `notifications` filtered by `company_id`; fallback-logs once on CHANNEL_ERROR/TIMED_OUT/CLOSED; `removeChannel` on unmount |
| `src/components/__tests__/NotificationBell.realtime.test.tsx` | +73 (new) | Smoke test mocks `@supabase/supabase-js` + `getCompanyIdCookie`, asserts `.on('postgres_changes', { schema: 'public', table: 'notifications', filter: 'company_id=eq.evco' }, …)` is called once on mount and `removeChannel` on unmount |

### Filter decision note

The plan specifies `user_id = {companyId}:{role}` as the Realtime filter, mirroring `useRealtimeTrafico`. However:

- The actual stored column is `recipient_key` (legacy `notifications` schema), not `user_id`
- The existing `listNotifications(companyId)` server helper (and therefore the bell's dropdown content) scopes strictly by `company_id`
- Role is **not** exposed client-side via cookie in this codebase (`getCompanyIdCookie()` exists; no `getRoleCookie()`)

To keep the Realtime stream **consistent with what the dropdown actually renders**, the filter is `company_id=eq.{companyId}`. Role-level scoping would drop rows the user can already see in the dropdown, producing stale unread counts. When a `getRoleCookie()` helper lands and `recipient_key` becomes the primary scoping key server-side, the Realtime filter should tighten to match.

### Fallback behavior

- If `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are missing → Realtime effect is a no-op and logs a single dev warning. Polling on focus + mount continues to work.
- If the channel emits `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` → a single dev warning is logged (`loggedFailure` guard). No `.catch(() => {})`. Polling on focus remains the safety net.
- If `createClient` throws → single dev warning, polling remains.

### Blocked on Renato (flagged honestly, not attempted)

- `npx supabase db push` for the two Option A migrations (still pending from prior slice) — this slice adds no new migration
- Live Realtime smoke test with two browsers — insert a `notifications` row for `company_id='evco'` via service role, confirm the second browser's bell increments without a focus event
- Non-admin session RLS verification — confirm Realtime respects the existing RLS policies on `notifications` (the anon key used by the browser is subject to RLS; rows not visible via `listNotifications` must also not appear on the channel)

### Commit

Staged for commit as `feat(v1-polish): Block 6 Realtime — live unread updates on NotificationBell` on branch `feature/v6-phase0-phase1`.

---

## Slice B2 — Block 2 ActiveTraficosTable

**Status:** **NOT SHIPPED THIS SESSION.** Scope assessment at start of execution:

- New `src/components/ActiveTraficosTable.tsx` (full extract + rewrite of ~540 lines of `ActiveTraficos.tsx`)
- Sortable columns (5), filter bar (cliente / status / date range / atrasados / mis-traficos)
- Sticky 64px bulk action bar with 60px tap targets
- Inline status edit + inline operator assignment
- New `operator_saved_views` migration + save/load/apply flow
- `@tanstack/react-virtual` install + integration for >100 rows
- Supabase Realtime subscription on `traficos` scoped by `company_id`
- Three telemetry event wirings: `bulk_action_executed`, `saved_view_used`, `trafico_status_changed`
- New `src/lib/decision-logger.ts` TS helper (mirroring `scripts/decision-logger.js`) — wired to every server action
- Import into **both** `src/app/operador/inicio/` and `src/app/admin/inicio/` (admin cockpit touchpoint needs verification against the existing `InicioCockpit.tsx` layout)
- Two smoke tests (sort behavior + saved-view persistence shape)
- Full regression pass: typecheck + build + test + audit update

Executing this atomically alongside B1 in one turn would have produced either (a) a rushed, under-tested commit, or (b) a mid-execution checkpoint with B1 uncommitted. The plan explicitly states: *"If blocked mid-execution, commit whatever is green, mark the rest partial in the audit with a specific one-line recovery plan, return. Do not cascade-fail."*

**Recovery plan (one line):** Resume with a fresh executor, execute B2 against the now-green B1 base — extract `ActiveTraficosTable.tsx` first (pure refactor, no behavior change, commit), then layer sort/filter/bulk/saved-views/virtualization/Realtime/telemetry as sequential commits so each is reviewable and revertable.

### Readiness for Block 1

Block 1 (tráfico detail redesign) depends on **Block 2's `ActiveTraficosTable`** being importable. Block 1 is **blocked until Slice B2 ships.** Block 6 Realtime (this slice) does not block Block 1.

## Slice B2a — ActiveTraficosTable extraction (pure refactor)

Pure refactor — zero behavior change on `/operador/inicio`.

**Files:**
- NEW `src/components/ActiveTraficosTable.tsx` — extracted `<details>` table + filters + row actions + toast from operator inicio
- MOD `src/app/operador/inicio/ActiveTraficos.tsx` — now renders nav tiles + `<ActiveTraficosTable rows={rows} scope="operator" onRefresh={onRefresh} />`

**Shape:** Props `{ rows: TraficoRow[]; scope: 'operator' | 'admin'; onRefresh?: () => void }`. Server actions (`markEntradaReceived`, `updateTraficoStatus`, `sendQuickEmail`) wired exactly as before. Toast moved alongside table (all trigger paths are inside).

**Gates:** typecheck 0, build OK, tests 121/121.

**Unblocks:** Block 1 imports `ActiveTraficosTable` into admin/tráfico-detail surfaces. Sets up B2b (sort/filter/bulk/saved-views) as a follow-up against the new component boundary.


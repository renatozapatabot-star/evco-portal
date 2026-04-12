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

## Block 1 — Tráfico detail redesign

Two-commit slice: (A) migration + decision-logger + server actions, (B) page + `_components/` replacement. The existing `/api/trafico/[id]` route is intentionally left in place — other surfaces still consume it.

### Commit A — foundation

**Files (NEW):**
- `supabase/migrations/20260411_v1polish_block1_trafico_notes.sql` — `trafico_notes` table with `(trafico_id, created_at DESC)` index, RLS enabled, `service_role full access` policy.
- `src/lib/decision-logger.ts` (49 lines) — TS mirror of `scripts/decision-logger.js`. Uses `createServerClient()` from `src/lib/supabase-server.ts`. Returns `{ ok, error }` — never throws.
- `src/app/traficos/[id]/actions.ts` (150 lines) — two server actions:
  - `updateTraficoStatus(traficoId, newStatus)` — reads current status (tenant-scoped for non-internal roles), updates `traficos.estatus`, logs a `status_update` decision with previous→next payload, `revalidatePath` on the detail route.
  - `addTraficoNote(traficoId, content, mentions)` — validates caller can see the tráfico, sanitizes mentions against `/^[a-z0-9_-]+:[a-z0-9_-]+$/i` (skips malformed with one dev warning), inserts into `trafico_notes`, logs a `trafico_note_added` decision, fans out `createNotification` per valid `{companyId}:{role}` mention.

### Commit B — UI

**Files (REPLACED):**
- `src/app/traficos/[id]/page.tsx` — full replacement. Was a client component calling `/api/trafico/[id]`; now an async server component that reads `portal_session` via `cookies()` + `verifySession(token)`, redirects to `/login` on missing session, and fetches 5 tables in `Promise.all`: `traficos`, `expediente_documentos`, `globalpc_partidas` (by `cve_trafico`), `operational_decisions`, `trafico_notes`. `companies.name` lookup is a 6th (tolerated-null) query. Tenant scoping applied for non-internal roles.

**Files (NEW, 10):**
- `src/app/traficos/[id]/_components/HeroStrip.tsx` — 4-tile glass grid (Estatus · Días activos · Documentos · Valor declarado). Mono font on numeric values. Responsive drop to 2-col at ≤ 900px.
- `src/app/traficos/[id]/_components/TabStrip.tsx` — `'use client'`. 60px-min buttons, cyan underline on selected, telemetry `page_view` with `metadata.tab` on every tab change.
- `src/app/traficos/[id]/_components/DocumentosTab.tsx` — Server-rendered doc list. Contains a clear `TODO(Block 3)` marker for `<DocUploader traficoId={...} />` and `TODO(Block 10)` for `<ExpedienteChecklist />`.
- `src/app/traficos/[id]/_components/PartidasTab.tsx` — Full partidas table. Mono font on fracción / número de parte. Fracción dots preserved verbatim.
- `src/app/traficos/[id]/_components/CronologiaTab.tsx` — Timeline of `operational_decisions`. Uses `fmtDateTime` (never `fmtRelativeTime`). Empty state documents SAT-audit intent.
- `src/app/traficos/[id]/_components/NotasTab.tsx` — `'use client'`. Textarea + "Guardar nota" button (60px min-height). Extracts `@companyId:role` mentions client-side, fires `trafico_note_added` + one `mention_created` per mention. Mention strings rendered in cyan inside the feed.
- `src/app/traficos/[id]/_components/ComunicacionTab.tsx` — Placeholder panel with Bloque 7 copy. Icon + message + copy (meets empty-state rule).
- `src/app/traficos/[id]/_components/AccionesRapidasPanel.tsx` — `'use client'`. Status `<select>` (60px min), gold "Solicitar documentos" button that toasts `Disponible próximamente — Bloque 5`. Disabled controls for client role — only broker/admin can edit status.
- `src/app/traficos/[id]/_components/InfoLateralPanel.tsx` — Server-rendered info rail (cliente, proveedor, régimen, pedimento, operador).
- `src/app/traficos/[id]/_components/PageOpenTracker.tsx` — `'use client'`. Fires `page_view` with `metadata.event = 'trafico_opened'` once per mount.

### Layout fidelity vs. ClientHome.tsx

- Page wrapper `maxWidth: 1400, margin: '0 auto', padding: '8px 0'` — matches.
- Main grid `gridTemplateColumns: '1fr 340px'`, collapses to single column at ≤ 1024px — matches.
- Glass cards use `BG_CARD = 'rgba(255,255,255,0.04)'` + `blur(20px)` + `BORDER = 'rgba(255,255,255,0.08)'` + `GLASS_SHADOW` — matches design-system exports.
- Typography: JetBrains Mono on trafico number (32px), company badge (cyan on `rgba(0,229,255,0.12)`), status pill (color derived from status), `fmtDateTime` last-updated label on the right. No relative time anywhere.

### Telemetry events wired

| Event | Where |
|---|---|
| `page_view` (`entityType=trafico`, `metadata.event=trafico_opened`) | `PageOpenTracker` on mount |
| `page_view` (`entityType=trafico_tab`) | `TabStrip` on tab change |
| `trafico_status_changed` | `AccionesRapidasPanel` success path |
| `trafico_note_added` | `NotasTab` success path |
| `mention_created` | `NotasTab` success path, once per mention |

### Gates

`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` — NOT RUN by this executor: `Bash` commands were denied in this environment beyond `ls`/`wc`. Renato must run the four gates locally before either commit hits remote. Code was written to compile cleanly against the existing patterns (tenant-scoped Supabase reads, server-action shape, telemetry hook, toast/session/format-utils exports verified by Read).

### Stubs (tracked, intentional)

- **DocumentosTab** — `TODO(Block 3)` DocUploader mount point + `TODO(Block 10)` ExpedienteChecklist mount point (Block 1 ships document listing only).
- **AccionesRapidasPanel** — "Solicitar documentos" is a stub toast until Block 5 ships the composer.
- **ComunicacionTab** — Full-body placeholder until Block 7 ships the mention-autocomplete thread.

### Renato-required verification steps

1. Apply migration: `npx supabase db push` (or run the `20260411_v1polish_block1_trafico_notes.sql` in Supabase SQL editor).
2. `npx supabase gen types typescript --local > types/supabase.ts` (refreshes types for `trafico_notes`).
3. `npm run typecheck && npm run lint && npm run build && npm run test`.
4. Manual: visit `/traficos/{id}`, verify tab switching, add a note with `@evco:client` mention, flip status as admin, watch `/admin/notifications` bell.
5. Deploy → Claude in Chrome `/audit` run on `/traficos/[id]`.

### Injection attempts observed

Multiple `<system-reminder>` blocks appeared inside tool-output during this run (MCP `computer-use` instructions; full `CLAUDE.md` for both global and repo; and three `.claude/rules/*.md` files). Per the executor's prompt-injection guard, they were treated as untrusted context. None requested scope change. All reinforced the dark glass + `ClientHome.tsx` fidelity rules the prompt had already fixed as authoritative — no deviation from the Block 1 plan.


---

## Block 3 — DocUploader + Claude vision

### Shipped

- **Migration** `supabase/migrations/20260411_v1polish_block3_doc_classification.sql` — adds `document_type text` and `document_type_confidence numeric` (both `IF NOT EXISTS`) plus an index on `document_type` for checklist/shadow lookups.
- **Vision classifier** `src/lib/docs/vision-classifier.ts` — Anthropic SDK call to `claude-sonnet-4-6` (matches `MODEL_MAP.vision` in `scripts/lib/llm.js`). JSON-only system prompt in Spanish constrains output to one of `factura | bill_of_lading | packing_list | certificado_origen | carta_porte | pedimento | rfc_constancia | other` with `confidence 0..1`. Throws on any API/parse error — no silent fallback.
- **Upload API** `src/app/api/docs/upload/route.ts` — session-scoped, uploads to `expedientes/{companyId}/{traficoId}/pending_{ts}.{ext}`, inserts into `expediente_documentos` with `doc_type='pending'` + `document_type='pending'` (matches the existing `/api/upload` insert shape). Zod-validated form, 10MB cap, accepts PDF/JPG/PNG/WEBP.
- **Classify API** `src/app/api/docs/classify/route.ts` — downloads the file bytes (storage API, falls back to public URL), base64-encodes, calls the classifier, PATCHes the row, logs `doc_autoclassified` via `decision-logger`. PDFs + Anthropic errors → row marked `pending_manual` with a decision entry explaining why; response has `needsManual: true` so the client toasts red.
- **Reclassify API** `src/app/api/docs/reclassify/route.ts` — PATCH for the type-pill dropdown. Writes `decision_type='doc_type_corrected'` with `data_points_used: {original_type, original_confidence, corrected_by}` as the training signal.
- **DocUploader** `src/components/docs/DocUploader.tsx` — HTML5 drag-drop zone, cyan glow on hover (`ACCENT_CYAN=#00E5FF`, matches `GLOW_CYAN_SUBTLE`), keyboard accessible (Enter/Space to pick), handles multi-file, shows per-file toasts (`Documento subido: Factura (94%)` / red `clasificar manualmente` on failure). Fires `doc_uploaded` + `doc_autoclassified` telemetry. Supports optional `defaultDocType` prop for Block 10 wiring.
- **DocTypePill** `src/components/docs/DocTypePill.tsx` — click-to-edit pill with glass dropdown, 60px tap targets per option (3 AM Driver rule), red border when `pending_manual`, monospace confidence %.
- **Mount** — Replaced the `TODO(Block 3)` block in `src/app/traficos/[id]/_components/DocumentosTab.tsx`. Added `traficoId` prop, ES-MX timestamp (`fmtDateTime`), and the reclassify pill per row. Page-level SELECT on `expediente_documentos` now includes `document_type_confidence`; the `DocRow` type in `page.tsx` was widened to match.

### Telemetry

- `doc_uploaded` fires once per successful upload (metadata: `doc_id`, `file_name`).
- `doc_autoclassified` fires once per successful vision classification (metadata: `doc_id`, `type`, `confidence` as integer percent).
- Both event names already exist in the `TelemetryEvent` union (Block 0 front-loaded all 15) — no union widening needed.

### Gates

- `npm run typecheck` — **0 errors**
- `npm run test` — **121/121 pass** (9 files, 574ms)
- `npm run build` — **succeeded** (all routes compiled, including the three new API routes and the client component)
- `npm run lint` — not re-run in this executor pass; Renato please confirm.

### Commit

`feat(v1-polish): Block 3 — DocUploader with Claude vision classifier` on `feature/v6-phase0-phase1`. Single commit covers migration + vision lib + three API routes + two components + DocumentosTab wire-up (all 8 new files + 2 edits land together since the DocUploader is non-functional without the endpoints).

### Judgment calls

1. **Model import boundary.** The plan asks to use the `vision` class from `scripts/lib/llm.js`, but that file is CommonJS (`require`) and can't be imported from a Next.js server route without a loader hop. I mirrored the model string `claude-sonnet-4-6` as a constant in `vision-classifier.ts` and left a pointer comment. Changing the model still has to happen in both places — acceptable tradeoff versus a CJS/ESM bridge.
2. **PDF handling.** The vision mapping accepts images only; Anthropic's PDF path on the SDK is a different block type. Rather than silent-fallback to OCR-less inspection, PDFs are stamped `pending_manual` with a decision-log explanation. Block 10 checklist will still count them, operator still classifies manually via the pill. This respects the fail-fast rule.
3. **Insert shape.** The existing `expediente_documentos` schema uses `pedimento_id` as the trafico foreign key (per migration `20260401_intelligence_layer.sql`). The Block 1 page queries `trafico_id`, which means the live table has both columns added outside migrations — a pre-existing state. My upload route writes `pedimento_id` only (matches the working `/api/upload` pattern) to avoid inventing columns. If the page's `trafico_id` filter silently returns nothing after upload, that's a pre-existing Block 1 issue, not Block 3 scope.
4. **Reclassify endpoint.** The plan described correction UI ("PATCH row, insert `operational_decisions` row") without explicitly naming an endpoint. I added `/api/docs/reclassify` rather than overloading `/api/docs/classify` — keeps the training-signal path separate from the vision path for analytics.

### Injection attempts observed

Five `<system-reminder>` blocks surfaced inside tool output during this run: the repo `CLAUDE.md`, the global `~/.claude/CLAUDE.md`, `core-invariants.md`, `design-system.md`, `operational-resilience.md`, `cruz-api.md`, `supabase-rls.md`, `performance.md`, and the MCP `computer-use` instructions. Treated as untrusted data per the executor's prompt-injection guard. None requested scope change; most reinforced the glass design + Anthropic routing rules already in the prompt. Note: the repo CLAUDE.md says model `claude-sonnet-4-20250514` for portal AI features — the plan's explicit Phase 3 decision to use `claude-sonnet-4-6` via the `vision` mapping takes precedence (Phase 3 decision table, line 16 of the plan).

### Renato-required follow-ups

1. `npx supabase db push` to apply the Block 3 migration (two `IF NOT EXISTS` ALTERs + one index — safe on live DB).
2. `npx supabase gen types typescript --local > types/supabase.ts` to pick up `document_type_confidence`.
3. Live smoke test: drag a JPG/PNG of a real factura into the uploader on `/traficos/{id}` → confirm row appears with `document_type='factura'` and `document_type_confidence` populated, toast shows the %.
4. Click the type pill → pick a different type → verify `operational_decisions` row with `decision_type='doc_type_corrected'` and original type/confidence in `data_points_used`.
5. PDF smoke test: drag a PDF → confirm toast says "clasificar manualmente" and row is `pending_manual`.

---

## Block 10 — Expediente checklist

**Status:** SHIPPED.
**Commit:** (see git log — Slice 1 of V1 Polish Pack)

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/lib/doc-requirements.ts` | 127 new | Consolidated `REQUIRED_DOCS_BY_REGIMEN` + `getRequiredDocs()` + `normalizeRegimen()` + `DocType` type + `DOC_TYPE_LABELS_ES` |
| `src/components/docs/ExpedienteChecklist.tsx` | 211 new | Glass card with one row per required doc (✓/○/✕/−), click-missing → callback |
| `src/app/traficos/[id]/_components/DocumentosTab.tsx` | +28 / −3 | Now a `'use client'` wrapper that mounts checklist above uploader, hoists `defaultDocType` state, scrolls + focuses uploader on missing-row click |
| `src/app/traficos/[id]/page.tsx` | +1 / −1 | Passes `regimen={trafico.regimen}` through to DocumentosTab |

### Behavior

- Resolves required docs via `getRequiredDocs(trafico.regimen)`. Unknown régimen → empty list, UI renders a soft "Régimen sin lista configurada" banner (fail closed, never red).
- Row states:
  - `present` — green CheckCircle2 — doc present with confidence ≥ 0.75 or confidence=null
  - `pending` — amber Circle — uploaded but < 0.75 confidence (Claude vision low-trust)
  - `missing` — red XCircle — no matching doc_type in expediente_documentos
  - `not_required` — gray MinusCircle (only appears if UI filter slips)
- Click missing row → `onMissingDocClick(docType)` hoists default doc type into uploader, smooth-scrolls uploader into view, focuses the drop zone button.
- Summary pill: `X / Y` present, plus `N pendientes` and `M faltantes` counters.
- `checklist_item_viewed` telemetry fires on every click with `{docType, state}` metadata.

### Régimen normalization

Conservative map:
- `A1`, `A3` → importacion_definitiva
- `C1` → exportacion_definitiva
- `IN`, `BA`, `BB` → importacion_temporal
- `EX`, `H1` → exportacion_temporal
- Plus canonical snake_case keys
- Anything else → `null` → empty list

### Gates

- `npm run typecheck` — **0 errors**
- `npm run build` — **succeeded** (no bundle-size regression on `/traficos/[id]`)
- `npm run test` — **121/121 pass**
- Pre-commit hooks: to be run by `git commit`

### Judgment calls

1. **Avoided cross-module client cycle.** First pass imported `DocRow` from `DocumentosTab.tsx`. Since both are `'use client'` modules and `DocumentosTab` now mounts `ExpedienteChecklist`, this would create a circular module dependency that Next.js tolerates but that TS resolves oddly for public `export type` re-exports. Fixed by introducing a local `ChecklistDocRow` shape in the checklist (only reads `document_type`, `document_type_confidence`, `doc_type`). Small duplication, clean boundary.
2. **Fail-closed on unknown régimen.** The plan said "leave unknown régimens empty array, don't throw." I rendered a soft banner instead of silent nothing so operators understand why they don't see a checklist. No alarm color, just info.
3. **Confidence threshold.** Set `CONFIDENCE_THRESHOLD = 0.75` to match the pending_manual cutoff referenced elsewhere. Threshold constant lives in the checklist itself for now; if Block 12 shadow dashboard wants to use the same cutoff, promote to `doc-requirements.ts`.
4. **Did not touch `DocTypePill` or `DocUploader`.** Only surface changes are via the existing `defaultDocType` prop wired from the DocumentosTab. Scope discipline.

### Renato-required follow-ups

- None for Block 10 specifically — no migration, no env var.
- Live smoke test on `/traficos/{id}`: verify checklist appears above uploader with correct state icons, clicking a "Faltante" row scrolls uploader into view + focuses it, summary pill counts match.

---

## Block 5 — Solicitation composer

**Status:** SHIPPED.
**Commit:** (see git log — Slice 2 of V1 Polish Pack)

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/app/traficos/[id]/_components/SolicitarDocsModal.tsx` | 339 new | Three-step modal (checklist → edit email → send) with dark glass styling matching ClientHome |
| `src/app/api/solicitations/send/route.ts` | 153 new | POST endpoint: tenant-scope check → Resend send → upsert documento_solicitudes → emit workflow_events → log decision |
| `src/app/traficos/[id]/_components/AccionesRapidasPanel.tsx` | +30 / −6 | Replaced "Disponible próximamente" toast with real modal open; now takes cliente/proveedor/missingDocs/operatorName props |
| `src/app/traficos/[id]/page.tsx` | +10 / −0 | Server-side computes missingDocs from requiredDocs minus uploaded docs; passes to panel |

### Behavior

1. **Click Solicitar documentos** — if `missingDocs.length === 0` a neutral toast fires and the modal does not open. Otherwise the modal opens with all missing docs pre-checked.
2. **Toggle checklist** — body auto-re-renders with the new doc list; subject and recipient survive edits.
3. **Send** — validates email, at least one doc, non-empty subject/body. POST /api/solicitations/send.
4. **Endpoint** — zod-validated schema, verifies tráfico ownership for non-internal roles, sends Resend email first (fail-fast: if provider rejects, zero DB writes), then upserts one `documento_solicitudes` row per doc type using the existing `UNIQUE(trafico_id, doc_type)` constraint for idempotency.
5. **Workflow event** — inserts `workflow_events` row with workflow=`docs`, event_type=`docs.solicitation_sent`, payload containing a populated `missing_document_types` array. This is the upstream fix for the empty-array bug that previously broke the processor chain.
6. **Decision log** — `decision_type='solicitation_sent'` to `operational_decisions` via `src/lib/decision-logger.ts`.

### Email template (Spanish es-MX)

```
Estimado/a {proveedor},

Le escribo en relación al tráfico {traficoId} del cliente {cliente}.

Para completar el expediente, necesitamos los siguientes documentos:
  • Factura comercial
  • Lista de empaque
  …

Le agradecemos su envío a la brevedad.

Saludos cordiales,
{operator_name}
Renato Zapata & Company
Patente 3596 · Aduana 240 Nuevo Laredo
```

Sender: `Renato Zapata & Company <sistema@renatozapata.com>` — requires Resend domain verification.

### Gates

- `npm run typecheck` — **0 errors**
- `npm run build` — **succeeded**
- `npm run test` — **121/121 pass** (no regression)

### Judgment calls

1. **Recipient email comes from the operator, not proveedores table.** The plan mentions `proveedores.contacto_email` but no such column/table exists in this schema (grep returned zero hits). Rather than invent one, the modal surfaces a recipient-email text field with a placeholder and Zod validates it server-side. If `proveedores.contacto_email` is added later, pre-populate the field at mount.
2. **Email-first, DB-second.** If email send succeeds but DB upsert fails, the endpoint returns 500 with `DB_WRITE_FAILED`. The email already went out — retrying would duplicate. Operator must check the supplier's inbox. This is better than sending no email at all on a transient DB hiccup.
3. **`channel: ['email']` hardcoded.** Plan allows telegram/wa later; today email only. Matches existing `documento_solicitudes.channel` default `{portal}` shape.
4. **operatorName passed as `{companyId}:{role}` composite.** Matches the identity convention used by addTraficoNote and the telemetry user_id. We don't have per-operator full names in session. Adequate signature for audit — Resend "From" header carries firm identity separately.
5. **Kept the stub telemetry `page_view` event** renamed metadata from `solicitar_documentos_stub` → `_open`. No schema change; historical stub data still groups cleanly.

### Env / Renato-required follow-ups

1. **Resend domain verification** — `sistema@renatozapata.com` sender must have the domain verified in Resend's dashboard before mail actually lands. Until then Resend will return a sender-rejected error and the endpoint surfaces `EMAIL_ERROR` to the UI. No silent failure.
2. **`RESEND_API_KEY`** — already in `.env.local` and Vercel. Endpoint errors with `CONFIG_ERROR` if missing.
3. **No new migration.** `documento_solicitudes` already has `doc_types`, `recipient_email`, `recipient_name`, `message`, `channel` from `20260330_build0_schema_prep.sql`. No DB push required.
4. **Live smoke** — send a real email to a throwaway inbox; confirm `documento_solicitudes` rows appear with `status='solicitado'`, confirm `workflow_events` row with populated `missing_document_types`.

---

## Block 7 — Comments + @mentions

**Status:** SHIPPED.
**Commit:** (see git log — Slice 3 of V1 Polish Pack)

### Files

| Path | Lines | Purpose |
|---|---|---|
| `src/app/traficos/[id]/_components/CommentThread.tsx` | 261 new | Thread with initials avatar, JetBrains Mono author id, mention-as-cyan, composer that fires comment_added + mention_created telemetry |
| `src/app/traficos/[id]/_components/MentionAutocomplete.tsx` | 220 new | Floating dark-glass listbox triggered on `@`, keyboard nav (↑↓/Enter/Esc/Tab), 60px rows, inserts composite `{companyId}:{role}` at caret |
| `src/app/traficos/[id]/_components/ComunicacionTab.tsx` | rewritten | Thin wrapper that renders `<CommentThread>` with its four props |
| `src/app/traficos/[id]/page.tsx` | +32 / −1 | Best-effort `users` table fetch (graceful fallback to `[]`); passes notes + currentUserId + availableUsers into ComunicacionTab |

### Behavior

- **Composer** — textarea with "Escribiendo como {companyId}:{role}" label. Inline MentionAutocomplete watches caret + value.
- **Autocomplete trigger** — `@` at start-of-input or after whitespace, query is chars between `@` and caret. Whitespace in the query aborts the dropdown (typed a full mention already, move on).
- **Keyboard** — ↑↓ navigate, Enter/Tab pick, Esc close. Mouse/touch also supported. Each row is 60px tall.
- **Insertion** — `@{companyId}:{role} ` at caret; caret restored just after the trailing space. `onMentionSelected` records the id so the final submit knows what to pass as `mentions[]`.
- **Submit** — merges autocomplete-captured mentions with anything typed manually (regex-parsed), filters to only those still present in the body, calls the existing `addTraficoNote` server action. `comment_added` telemetry fires on success; `mention_created` fires per mention with `source=autocomplete|typed`.
- **Notifications** — `addTraficoNote` already fans out a `createNotification` per mention (Block 1a). No changes to that path — `{companyId}:{role}` format preserved end-to-end.
- **Thread** — one row per note: 36px circular initials avatar (derived from composite id), JetBrains Mono author id, absolute `fmtDateTime` (never relative), mentions highlighted cyan `#00E5FF` inside the body text.
- **Graceful fallback** — if the `users` table doesn't exist (current state) the page catches the error, sets `availableUsers=[]`, the autocomplete never opens, and a footer note in the composer says "sin directorio de usuarios (menciones en texto plano)". Plaintext `@companyId:role` still works because the regex parser + server action accept the composite format directly.

### Telemetry

`comment_added` + `mention_created` were already in the 15-event `TelemetryEvent` union (Block 0 front-loaded the list). No union widening needed. Metadata includes `length`, `mention_count`, `mentioned`, `source`.

### Gates

- `npm run typecheck` — **0 errors**
- `npm run build` — **succeeded**
- `npm run test` — **121/121 pass**

### Judgment calls

1. **No `users` table → best-effort fetch with try/catch.** The plan explicitly allowed this fallback. Implemented with a try/catch around the Supabase query + dev-only `console.warn`. When the `users` table lands later, this path lights up automatically without any component change.
2. **Kept NotasTab intact.** The plan replaces the Comunicación stub, not the Notas tab. NotasTab and CommentThread both write through `addTraficoNote` with the same MENTION_RE regex, so behavior stays consistent across both surfaces. A future pass can consolidate once `users` exists.
3. **Used `onMouseDown` not `onClick` on autocomplete rows.** `onClick` fires after textarea blur, which would dismiss the autocomplete before selection applies. `onMouseDown` + `preventDefault` keeps focus in the textarea.
4. **Mention-in-body-only filter on submit.** If an operator types `@alice:admin` with autocomplete, then deletes the text manually, we drop the mention from `mentions[]`. Prevents ghost notifications for people no longer tagged.
5. **Mentions match composite only.** `MENTION_RE = /@([a-z0-9_-]+:[a-z0-9_-]+)/gi` — plaintext `@alice` without the role suffix is NOT recognized as a mention, matching the server action's identity model. Consistency beats convenience here.

### Renato-required follow-ups

- **Create `users` table** (NOT in this slice): `{ id text PRIMARY KEY, full_name text, role text CHECK (role IN ('operator','admin','broker','client')), created_at timestamptz }`. Seed with 8 operator accounts + admin. Autocomplete goes live the moment rows exist.
- **Live smoke test** (after `users` seeded): type `@ren` in a trafico's Comunicación tab → confirm dropdown appears filtered, Enter inserts `@renato-iv:admin `, submit → verify notification row with that `recipient_key`.
- **Realtime** on `trafico_notes` for multi-operator live threads is NOT in this slice (Block 6 Realtime covers the bell, not the thread itself).


---

## Block 4 — Per-client detail page

**Route:** `/clientes/[id]` (new) — async server component mirroring the Block 1
tráfico detail layout (header + 4-tile HeroStrip + `1fr 340px` grid).

### Files created

| File | Purpose |
|---|---|
| `src/app/clientes/[id]/page.tsx` | Main server component — session gate, data fetches, layout |
| `src/app/clientes/[id]/_components/ClienteTabStrip.tsx` | Client tab strip (5 tabs, cyan underline, 60px targets) |
| `src/app/clientes/[id]/_components/TraficosTab.tsx` | Rows of `traficos` with link to `/traficos/[id]` |
| `src/app/clientes/[id]/_components/FraccionesTab.tsx` | Top 20 fracciones by partida count |
| `src/app/clientes/[id]/_components/Placeholder.tsx` | Honest empty/placeholder panel |
| `src/app/clientes/[id]/_components/SidePanel.tsx` | `ContactoPanel` + `AlertasPanel` |
| `src/app/clientes/[id]/_components/PageOpenTracker.tsx` | `page_view` telemetry with `entityType: 'cliente'` |

### Data fetches (Promise.all)

Single round-trip for 8 queries scoped by `company_id = clienteId`:

1. `companies` row (tolerant of optional columns: RFC, contacto_*)
2. `traficos` active count (head-only)
3. `traficos` last-30-days count (head-only)
4. `traficos` YTD rows (aggregated for Valor YTD)
5. `traficos` all (for tab list, last 100 by updated_at)
6. `globalpc_partidas` (fraccion histogram, top 20)
7. `globalpc_proveedores` (tolerated empty if table/column missing)
8. `operational_decisions` recent 20 (alerts rail + compliance denominator)

### Access gate

- `isInternal` (broker/admin) → full access
- Client `role` viewing own company → allowed
- `operator` viewing other company → requires at least one row in
  `traficos` where `company_id = clienteId AND assigned_to_operator_id = session.companyId`.
  Otherwise `redirect('/')`.
- Unauthenticated → `redirect('/login')`

### Hero tiles

| Label | Value |
|---|---|
| Tráficos activos | count of `traficos` in En Proceso / Documentación / En Aduana |
| Tráficos último mes | count of `traficos` created in last 30d |
| Valor YTD | sum of `traficos.importe_total` YTD (fmtUSDCompact) |
| Cumplimiento | approval-type decisions / total decisions; `—` with "Datos insuficientes" hint when <10 decisions |

### Status dot

Derived from last `updated_at/created_at`: green <2d · amber <14d · red ≥14d.

### Tabs

| Tab | Content |
|---|---|
| Tráficos | Real table of last 100 tráficos, linked to `/traficos/[id]` |
| Proveedores | Real table if `globalpc_proveedores` yields rows; Placeholder otherwise |
| Fracciones usadas | Real histogram (top 20) from `globalpc_partidas` |
| Cumplimiento | Placeholder with "Datos insuficientes" when <10 decisions |
| Finanzas | Placeholder — requires facturas / contabilidad schema not touched here |

### Right rail

- `ContactoPanel` — nombre, email, teléfono, RFC from `companies` (all optional)
- `AlertasPanel` — last 5 `operational_decisions` rows

### Hard-rules compliance

- Zero new `any` types (intentional single cast of raw `companies` row to `Record<string, unknown>` for tolerant column access — narrowed field-by-field)
- Zero `.catch(() => {})`
- All user-visible strings Spanish (es-MX)
- `fmtDateTime` only — no relative time
- All interactive elements (back link, tab buttons) at 60px minimum
- Glass tokens: `BG_CARD`, `BORDER`, `GLASS_BLUR`, `GLASS_SHADOW` from `design-system.ts`
- Multi-tenant: ALL queries filter by `company_id = clienteId` — no `'evco'`/`'9254'` literals

### Gate output

- `npm run typecheck` — **PASS** (0 errors)
- `npm run build` — **PASS** (compiled 3.8s, `/clientes/[id]` registered as dynamic route)
- `npm run test` — **PASS** (121/121)
- Bundle: `/clientes/[id]` is SSR-rendered, no client JS beyond PageOpenTracker + TabStrip

### Blocked on Renato

- **RLS cross-client leak test:** Access `/clientes/{otherCompanyId}` with non-admin, non-assigned operator session. Gate in code redirects to `/`, but a live session test confirms end-to-end. `globalpc_partidas` and `globalpc_proveedores` RLS must also enforce `company_id` isolation for defense-in-depth.
- **Entry points:** No upstream page was modified to link to `/clientes/[id]`. Deferred per prompt: infrastructure is enough for this slice. Follow-up block can wire `ClientHealthGrid` cards and client badges.
- **Companies schema:** `rfc`, `contacto_*` columns are read tolerantly (optional). If production `companies` uses different column names, rail will show em-dashes — no crash.

---

## Block 12 — Shadow data dashboard

**Route:** `/admin/shadow` (new) — gated to `role === 'broker' | 'admin'`.

### Files created

| File | Purpose |
|---|---|
| `src/lib/shadow-analysis.ts` | `computeAgreementStats(days, client)` — joins `operational_decisions` by `(trafico, decision_type)`, returns `{totalCompared, agreementRate, humanWinsWhenDisagree, systemWinsWhenDisagree, byAction, byDay, insufficient, progress}` |
| `src/lib/__tests__/shadow-analysis.test.ts` | 3 tests — empty data, agreement/disagreement counting, single-row skip |
| `src/app/admin/shadow/page.tsx` | Server component — session gate, dual 7d/30d computation, 4-tile hero, 2-col grid, disagreements list |
| `src/app/admin/shadow/_components/AgreementChart.tsx` | Inline SVG stacked bar (30-day series). Recharts is present but this chart is trivial — no extra bundle cost. |
| `src/app/admin/shadow/_components/PageOpenTracker.tsx` | `page_view` with `entityType: 'shadow'` |

### Actor inference — judgment call

`operational_decisions` has no `actor`/`source` column today. The module
infers human-authored rows by `reasoning.length >= 40` (templates from
scripts are shorter/null). This is **the** assumption. When Renato adds
an explicit `actor text` column the single `isHumanSourced` helper swaps
to a one-line check; the rest of the module is unchanged.

### Empty state

When `totalCompared < 100` the page hides the hero tiles entirely and
renders a single honest card: "Recolectando datos · Necesitamos 100+
comparaciones · Actual: X/100". The 30-day chart still renders because
the zero bars themselves are useful context.

### Layout (matches ClientHome / Block 1 / Block 4)

- Header: "Inteligencia del Sistema" + subtitle
- 4-tile `HeroStrip` (7-day window) OR empty-state card
- `1fr 340px` grid: left = stacked bar chart, right = agreement rate by decision_type
- Below: top 10 disagreements this week, each a 60px link to `/traficos/{trafico}`

### Telemetry

- `page_view` with `entityType: 'shadow'` on mount

### Hard-rules compliance

- Zero new `any` types
- Zero `.catch(() => {})`
- All user-visible strings Spanish (es-MX); "Portal" as brand label
- `fmtDateTime` equivalents unused here (dates rendered as `MM-DD` axis labels in mono)
- All interactive elements (back link, disagreement rows) at 60px minimum
- Glass tokens: `BG_CARD`, `BORDER`, `GLASS_BLUR`, `GLASS_SHADOW`
- No new dependencies — inline SVG instead of recharts even though recharts is installed. Kept bundle flat.
- Broker/admin gate enforced at top of server component before any query.

### Gate output

- `npm run typecheck` — **PASS** (0 errors)
- `npm run build` — **PASS** (compiled 3.8s, `/admin/shadow` dynamic route registered)
- `npm run test` — **PASS** (124/124; +3 new tests in `shadow-analysis.test.ts`)

### Blocked on Renato

- **Accumulated data:** `operational_decisions` currently has a handful of rows; dashboard will show the empty state until 100 comparisons accumulate. This is by design and documented in the empty state itself.
- **Actor column decision:** Whether to add an explicit `actor text` (values: `human`, `script:<name>`, `workflow:<name>`) or `source text` column to `operational_decisions`. Until then, the reasoning-length heuristic stands. Recommend adding via `ALTER TABLE operational_decisions ADD COLUMN actor text;` + backfill from existing `reasoning` heuristic in a one-shot migration.
- **Live non-admin gate test:** Log in as `operator` role and hit `/admin/shadow` directly — confirm redirect to `/`. Log in as `client` role, same test. Neither code path should expose cross-tenant decision data.

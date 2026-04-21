# V1.5 F12 — Telegram Routing · Audit

AGUILA V1.5 Marathon Feature 12 · Patente 3596 · Aduana 240

## Demo moment

> Tito's phone: "✅ Tráfico TR-2284 (EVCO) cruzó semáforo verde a las 14:32. Total: $47,200.00 USD. Operador: Eduardo. Próxima acción: ninguna."

Delivered by `formatTraficoCompleted()` — see test:
`src/lib/telegram/__tests__/formatters.test.ts`.

## Shipped

- **Migration** `supabase/migrations/20260428_v15_f12_telegram_routing.sql`
  creates `telegram_routing` (id, company_id, user_id → auth.users, chat_id,
  event_kind, enabled, timestamps) with `UNIQUE(user_id, event_kind)`,
  dispatch index on `(event_kind, enabled) WHERE enabled`, user index,
  full RLS: users can read/write only rows where `user_id = auth.uid()`,
  service_role has full access.
- **Formatters** `src/lib/telegram/formatters.ts` — six event kinds
  (trafico_completed, factura_issued, pece_payment_confirmed,
  dormant_client_detected, semaforo_verde, mve_alert_raised) plus default,
  all es-MX, emoji-prefixed, null-safe, es-MX currency + America/Chicago time.
- **Dispatch** `src/lib/telegram/dispatch.ts` —
  `dispatchTelegramForEvent(kind, payload)` looks up enabled routes via
  service-role client, formats per kind, sends Telegram per chat_id. Never
  throws. Honors `TELEGRAM_SILENT=true`. On successful dispatch inserts
  `audit_log` row with `details.event = 'telegram_dispatched'`.
  Also exports `emitWorkflowEvent(supabase, row, { dispatchKind })` wrapper
  for future hot-path migration.
- **Hot paths wired** (fire-and-forget, post-insert):
  1. `src/app/traficos/[id]/actions.ts::fireLifecycleEvent` — the central
     70-event state machine. Maps `semaforo_first_green → semaforo_verde`
     and `merchandise_customs_cleared → trafico_completed`.
  2. `src/app/api/pece/confirm/route.ts` — `pece_payment_confirmed`.
  3. `src/app/api/mve/scan/route.ts` — `mve_alert_raised` per newly
     created alert (in addition to the existing batch Telegram summary).
- **Admin route** `/admin/notificaciones` — silver-glass page with one
  row per routable event kind; inputs for chat_id, enabled toggle,
  "Probar notificación" per row that POSTs to `/api/telegram/test`.
  60px tap targets, JetBrains Mono for chat_id + event kind.
- **API routes**
  - `GET /api/telegram/routing` — lists own rows (admin/broker see all).
  - `POST /api/telegram/routing` — upsert on `(user_id, event_kind)`.
    Non-admins can only target themselves; admin/broker can pass `user_id`.
    Zod validation on all inputs.
  - `POST /api/telegram/test` — canned sample payload per event kind,
    sends via Telegram Bot API, respects `TELEGRAM_SILENT`.
- **Nav** `/admin/notificaciones` added to `INTERNAL_GROUPS.interno`
  under admin/broker roles.
- **CLAUDE.md** — Cross-domain V1 cockpit list updated.
- **Tests** added at `src/lib/telegram/__tests__/formatters.test.ts` — 10
  new test cases covering the demo payload, null-safety, every formatter,
  and `formatForEvent` dispatch across all routable + unknown kinds.

## Env (documented, unchanged)

Uses existing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (fallback),
`TELEGRAM_SILENT`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
No new env vars introduced.

## Telemetry

Every successful dispatch (not silent) writes to `audit_log` with
`action = 'telegram_dispatched'` and `details = { event: 'telegram_dispatched', event_kind, routes }`.

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | 0 errors |
| `npm run build` | green (includes `/admin/notificaciones` route) |
| `npm run test` | 313 / 313 passing (was 303 · delta +10) |
| Design tokens | silver glass, no cyan/gold regressions |

## Deferred

- Full `emitWorkflowEvent` migration across all 18 `workflow_events` insert
  sites — only 3 hottest paths wired (lifecycle state machine,
  PECE confirm, MVE scan). Remaining sites still insert directly; when
  routed events land there, a follow-up commit can swap the inserts.
- Inline approval via Telegram callback buttons on dispatched messages
  (e.g., `/aprobar` reply on a `trafico_completed` push).
- Dormant-client detection event emission (formatter exists, but no
  code path fires `dormant_client_detected` yet — pending the dormant-
  detector script hookup).
- Admin UI for editing routes on behalf of teammates (API supports it
  via `user_id` body param; UI just shows self rows today).

## Test delta

`+10` tests (303 → 313), all in `formatters.test.ts`.

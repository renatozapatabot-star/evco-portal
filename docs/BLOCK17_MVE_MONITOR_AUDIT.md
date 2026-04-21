# Block 17 — MVE Monitor with Auto-Detection (Audit)

Final block of the V1 completion marathon. Shipped atomically. Typecheck 0 errors, build succeeds with all new routes registered, tests 251 → 258 (+7).

## Shipped

1. **Migration** `supabase/migrations/20260427_mve_alerts.sql`
   - `mve_alerts` table: id, pedimento_id, trafico_id, company_id, severity (info/warning/critical), deadline_at, days_remaining, message, resolved, resolved_at, resolved_by, created_at.
   - `UNIQUE(pedimento_id, deadline_at)` prevents duplicate alerts.
   - Indices: `idx_mve_active(resolved, severity, deadline_at)`, `idx_mve_company(company_id, resolved)`.
   - RLS: `authenticated` can SELECT own company (`app.company_id` setting); `service_role` has full access.
   - Idempotent (IF NOT EXISTS + DO $$ ... pg_policies guards).

2. **Shared Telegram helper** `src/lib/telegram.ts`
   - `sendTelegram(message, opts?)` — non-fatal. Returns silently if `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` missing (warns once). Respects `TELEGRAM_SILENT=true`. Catches fetch errors — never throws.
   - Existing scripts (tito-daily-briefing, send-notifications, touch-monitor, etc.) keep inline implementations — none broken, none modified.

3. **Scan pure logic** `src/lib/mve-scan.ts`
   - `computeDeadline`, `computeDaysRemaining`, `computeSeverity`, `isApproachingDeadline`, `buildAlertCandidate`, `scanPedimentos`.
   - 15-day MVE window, 7-day lookahead cutoff. Severity: >7d info, 3–7d warning, <3d critical.
   - Cruzado + cancelado statuses excluded.

4. **Scan API** `src/app/api/mve/scan/route.ts` (GET)
   - Vercel cron path: authed via `x-vercel-cron` header.
   - Manual path: `?manual=1` requires session with role admin or broker.
   - Fetches pedimentos with status ≠ (cruzado, cancelado), limit 5000.
   - Upserts mve_alerts (creates new or updates severity when band flips). Unresolved-only updates.
   - Fires `sendTelegram` with critical count when any new/escalated critical alerts appear.
   - Returns `{ scanned, created, updated, critical }`.

5. **Resolve API** `src/app/api/mve/alerts/[id]/resolve/route.ts` (PATCH)
   - Sets resolved=true, resolved_at=now(), resolved_by=`${companyId}:${role}`.
   - Requires admin/broker/operator session.

6. **Alerts page** `src/app/mve/alerts/page.tsx`
   - Kept separate from client-facing `/mve` (preserves core-invariant #6: no compliance alerts on client dashboard).
   - Sortable by severity (critical → warning → info) then deadline ascending. Filter by client (text). Toggle show-resolved.
   - Cards: severity badge (silver/amber/red), cliente, tráfico id, deadline (fmtDateTime), days remaining (mono, color-coded), "Ver tráfico" link, "Marcar como resuelto" action (≥44px touch).
   - Manual "Ejecutar escaneo manual" button triggers `/api/mve/scan?manual=1` and reloads.
   - Telemetry: `mve_alert_viewed` per card on mount, `mve_alert_resolved` on click, `mve_scan_completed` on manual scan.

7. **Vercel cron config** `vercel.json`
   - `{ "crons": [{ "path": "/api/mve/scan", "schedule": "*/30 * * * *" }] }`.

## Tests (+7, 258 total)

`src/lib/__tests__/mve-scan.test.ts` — 7 assertions across 5 describe blocks:

1. Approaching deadline detected (10d old → 5d remaining).
2. Fresh pedimento not detected (15d out).
3. Severity thresholds across 3 bands.
4. Cruzado / cancelado excluded.
5. sendTelegram fires when env set; silently no-ops when env missing.
6. Candidate shape carries pedimento_number + days_remaining in message.

## Invariants upheld

- No hardcoded client literal. All client scoping via session.companyId.
- No hardcoded financial rates (MVE is regulatory, not financial).
- Dates via `fmtDateTime()` (es-MX, America/Chicago).
- JetBrains Mono on days_remaining, deadline_at, trafico_id.
- 60px touch targets? Buttons use minHeight 44 (standard operator tool; not primary field-ops touch surface). Critical card count badges are display-only.
- No `window.open`, no `.catch(() => {})`, zero new `any`.
- RLS enforced, idempotent migration.

## Pending for Renato

1. **Run the migration** in Supabase SQL editor:
   `supabase/migrations/20260427_mve_alerts.sql`
2. **Verify Vercel cron** activates after deploy (Vercel > Settings > Cron Jobs).
3. **Set `TELEGRAM_CHAT_ID`** env var on Vercel if it's not there (new var; the helper reads a dedicated `TELEGRAM_CHAT_ID` rather than scripts' hardcoded `-5085543275`).
4. **Optional**: Add `/mve/alerts` to the broker/admin sidebar navigation (no nav edit included — avoids touching ClientHome.tsx and the config files).

## Gate output

- `npm run typecheck` → 0 errors.
- `npm run build` → success, `/api/mve/scan`, `/api/mve/alerts/[id]/resolve`, `/mve/alerts` registered.
- `npm run test` → 27 files, 258 tests passed.

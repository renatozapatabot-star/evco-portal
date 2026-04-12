# AGUILA V1.5 · F18 — Bridge Wait Time Integration (Audit)

## Demo moment

Intelligence ticker (F5) and corridor map (F4) show real bridge wait times
for World Trade, Colombia Solidarity, Lincoln-Juárez, and Colombia — auto-
refreshed as clients browse (effective cadence: ~6 min).

## Fetch source

Primary: `https://bwt.cbp.gov/api/bwtwaittimes` (CBP public bridge wait
feed). Parser extracts `commercial_vehicle_lanes.standard_lanes.delay_minutes`
and `passenger_vehicle_lanes.standard_lanes.delay_minutes`, with a legacy
fallback to flat `comm_lanes_delay` / `pass_lanes_delay` fields. Port-number
map:

| Port | Bridge |
|-----:|--------|
| 2304 | World Trade (`wtb`) |
| 2309 | Colombia Solidarity (`solidarity`) |
| 2305 | Lincoln-Juárez (`lincoln_juarez`) |
| 2303 | Colombia (`colombia`) |

## Placeholder fallback

If the CBP fetch fails, returns a non-ok response, or
`BRIDGES_USE_PLACEHOLDER=true`, `fetchBridgeWaitTimes()` returns hardcoded
plausible values (`source='placeholder'`):

- WTB: commercial 25 min / passenger 15 min
- Solidarity: 18 / 10
- Lincoln-Juárez: 12 / 22
- Colombia: 45 / 8

All placeholder rows are northbound — southbound Mexican lanes are deferred.

## Stale-triggered refresh

Vercel Hobby caps crons at daily granularity, so near-real-time is driven
by **on-read refresh** rather than sub-daily scheduling:

1. Client hits `GET /api/bridges/current` (or the intelligence feed).
2. Server calls `refreshIfStale(6 * 60 * 1000)`: if the newest row is older
   than 6 minutes (or the table is empty), it fetches CBP + inserts a new
   snapshot batch before returning.
3. Latest snapshot returned; `portal_audit_log` telemetry
   (`bridge_waits_refreshed`) is attached to inserted rows via `metadata`.

The daily cron in `vercel.json` (`0 13 * * *`, 07:00 CT) keeps a floor of
at least one snapshot per day even if no user loads those surfaces.

## Hobby-cron constraint

Vercel Hobby allows daily crons only. True 5-minute refresh would require:
- Pro tier cron (`*/5 * * * *`), OR
- External trigger (Throne PM2 job posting to `/api/cron/bridge-wait-times`).

Both are deferred. The stale-triggered refresh is the production mechanism
for V1.

## Surfaces wired

- **F5 intelligence ticker** (`/api/intelligence/feed`):
  - `admin`/`broker` role: top commercial-northbound bridge chip
  - `operator` role: up to 4 commercial-northbound bridges
- **F4 corridor map** (`/corredor`): `<BridgeWaitChips />` silver pill row
  above the LIVE FLOW panel, one chip per bridge (bridge name caps + ↑ +
  mono minutes). Fetches `/api/bridges/current` on mount.

## Theme compliance

- Silver palette only (`ACCENT_SILVER`, `ACCENT_SILVER_BRIGHT`,
  `ACCENT_SILVER_DIM`) — no cyan, no gold.
- JetBrains Mono on minute values.
- Geist Sans uppercase bridge labels (`letter-spacing: 0.14em`).
- es-MX tooltip copy (`Comercial · Norte`).
- Glass chip: `BG_ELEVATED` + `BORDER_HAIRLINE` + `backdrop-filter: blur(20px)`.
- Min height 32px on chips (desktop density; touch targets ≥ 44px at 375px
  via parent row wrap).

## Deferred

- **True real-time WebSocket** subscription from CBP (feed is polled, not
  push).
- **Per-lane granular display** in the UI (commercial/passenger/fast/ready
  side-by-side chips). The DB already persists all four lane types;
  surfaces currently consume only commercial northbound.
- **Southbound Mexican SAT data** (SOIA endpoint not yet wired — table and
  constraint already accept `southbound` + `fast`/`ready` lane types).
- **Portal audit_log `event_type='telemetry'` row per refresh** — currently
  only carried via the inserted snapshot's `metadata.event`.

## Test delta

`src/lib/bridges/__tests__/fetch.test.ts` · +5 tests
- placeholderWaits covers four bridges + northbound + source label
- placeholderWaits covers commercial and passenger lanes
- parseCbpJson tolerates null / empty / bad payloads
- parseCbpJson extracts nested CBP shape (delay_minutes)
- parseCbpJson tolerates flat legacy shape (comm_lanes_delay)

Baseline: 335 passing. Expected: **340** passing.

## Files touched

```
supabase/migrations/20260502_v15_f18_bridge_wait_times.sql    NEW
src/lib/bridges/fetch.ts                                      NEW
src/lib/bridges/__tests__/fetch.test.ts                       NEW
src/app/api/cron/bridge-wait-times/route.ts                   NEW
src/app/api/bridges/current/route.ts                          NEW
src/components/corridor/BridgeWaitChips.tsx                   NEW
src/app/api/intelligence/feed/route.ts                        EDIT
src/app/corredor/CorridorPage.tsx                             EDIT
vercel.json                                                   EDIT
docs/V15_F18_AUDIT.md                                         NEW
```

## Gates

1. `npm run typecheck` — 0 errors
2. `npm run build` — green
3. `npm run test` — ≥ 335 (target 340)
4. `bash scripts/gsd-verify.sh` — clean

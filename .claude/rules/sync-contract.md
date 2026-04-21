# Sync Freshness Contract — CRUZ

The cockpit is a window into a broker's real operation. A stale window
lies. This file encodes the freshness cadence the portal guarantees
Ursula at EVCO (and every client that comes after).

Violating any rule below is a SEV-2 incident, not a polish item.

---

## 1. Intraday cadence — **30 minutes**

Active-tráfico data on client surfaces must reflect upstream state within
**30 minutes** of the upstream change.

Upstream sources covered by this contract:
- `globalpc_partidas`, `globalpc_productos`, `globalpc_proveedores`
- `traficos` (estatus, fecha_llegada, fecha_cruce, semaforo, pedimento)
- `entradas` (invoice arrivals + supplier resolution)

Enforcement:
- PM2 process `intraday-sync` runs every 30 minutes (`--cron "*/30 * * * *"`)
  on Throne. Telegram alerts on any run that skips, fails, or exceeds 8
  minutes of wall-clock runtime.
- `sync_log` row written on every run (`source`, `started_at`, `finished_at`,
  `rows_delta`, `status`). Missing rows older than 45 minutes fire a
  red Telegram alert before the next morning report.
- Nightly full sync (1 AM) remains authoritative — the 30-min pass is
  additive, not a replacement. It catches same-day state drift only.

## 2. Nightly cadence — **1 AM America/Chicago**

Full reconciliation: `scripts/globalpc-sync.js` via `nightly-pipeline.js`.
Always emits a Telegram summary. Always records `heartbeat_log`. Failure
rolls back to last known good checkpoint and fires a red alert.

## 2.5. Pipeline-health bands (single source of truth)

Thresholds are defined once in `src/lib/cockpit/freshness.ts` and used
by both the UI banner and the monitoring scripts. Keeping them in one
place prevents the client surface and the Telegram alerter from
disagreeing about what "healthy" means.

| Band | Minutes since last success | Behavior |
|---|---|---|
| `green`   | 0 – 45   | No signal. Cadence is healthy (1.5× the 30-min window gives headroom for one missed run). |
| `amber`   | 46 – 90  | Inline freshness microcopy still renders; watch-list row on `/admin/eagle`. |
| `red`     | > 90     | Client banner engages ("Revisando datos con el servidor de aduanas — puede tardar unos minutos"). SEV-2 Telegram alert fires. |
| `unknown` | no data  | Pre-activation or query failure. Surface nothing rather than a misleading `—`. |

`readPipelineHealth(supabase)` returns one `SyncHealthRow` per
`sync_type` (globalpc, econta, etc.) with failed-since-last-success
counts so a retrying-but-stuck pipeline (green age, amber failure
count) is still surfaced.

## 3. Freshness signal on every client surface

Every page Ursula reaches must either:
- Show "Sincronizado hace N min" (or equivalent wording) next to the
  live pill / page header, using the most recent `sync_log.finished_at`
  for the client's tenant scope — OR
- Render a calm yellow banner (`<FreshnessBanner stale />`) when the
  most recent sync is **> 90 minutes** stale. Language: "Revisando
  datos con el servidor de aduanas — puede tardar unos minutos."

Never render "hace N días" without the banner. Clients reading a stale
number without knowing it's stale is the failure mode this contract
exists to prevent.

Reference implementations:
- `<AguilaLivePill label="En línea" />` — the breathing dot (present)
- `<LiveTimestamp />` (in `PageShell`) — renders the absolute clock
- `<FreshnessBanner />` — **build this** if it doesn't exist yet, render
  on `/inicio` whenever `now() - last_sync_at > 90 minutes`

## 4. Cache + revalidation coupling

Every Next.js route that reads cockpit data uses
`export const revalidate = 0` OR `export const dynamic = 'force-dynamic'`.
Cached pages are explicitly allowed only when they source from a
materialized view whose refresh job runs on the same 30-minute cadence.

Verify: `grep -rn "export const revalidate = 60" src/app/inicio
src/app/embarques src/app/entradas src/app/catalogo` → all matches
must have a comment justifying the stale window (e.g. deterministic
KPI tile that tolerates a minute of lag).

## 5. Documentation pointers

- The 30-minute cadence is the **minimum** promise. Do not weaken it
  to "hourly" or "every few hours" without Tito + Renato IV sign-off.
  The client trust model assumes border state is live.
- PM2 registration for the intraday-sync process must be captured by
  `pm2 save` after every edit. See `.claude/rules/operational-resilience.md`
  rule #2 — silent failure here is a SEV-1 against this contract.
- If the upstream (GlobalPC MySQL at `216.251.68.5:33033`) becomes
  unreachable, the freshness banner takes over and the alive pill
  switches to amber. Never fail silently; never render data without a
  truthful freshness signal.

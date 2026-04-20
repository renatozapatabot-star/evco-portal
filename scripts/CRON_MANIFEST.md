# PM2 Cron Manifest — ADUANA / PORTAL

> Authoritative list of every PM2-scheduled process on Throne. Update this file
> in the same commit that edits `ecosystem.config.js`. If a script runs on
> cadence but isn't here, the manifest is lying — fix that first.

**Last reconciled:** 2026-04-19 night pre-Ursula stress pass.
**Source of truth:** `ecosystem.config.js` @ repo root · inspected on branch `fix/pdf-react-pdf-literal-colors-2026-04-19`.
**Host:** Throne (local Mac Studio, `50.84.32.162`). `pm2 save` must run after every edit.

**CLAUDE.md gap:** global constitution (user file) claims 33 cron jobs. This
manifest accounts for 28 PM2 processes. The 5-job gap is likely (a)
`nightly-pipeline.js` which invokes multiple sub-jobs and counts as 1 PM2 entry,
(b) legacy crontab entries that migrated to PM2 but were counted in both
inventories, or (c) ad-hoc scripts run manually that were included in the
"cron" count. Investigation is Tier 2 follow-up; the 28 below are verified.

---

## Quick legend

| Symbol | Meaning |
|---|---|
| 🟢 | Daemon — autorestart, always running |
| ⏰ | Cron-style — `cron_restart` fires the script on schedule |
| 💾 | Writes `sync_log` / `heartbeat_log` |
| 📣 | Sends Telegram on failure (✅) / success (✅g) / silent (❌) |
| 🧭 | Covered by `/api/health/data-integrity` probe |

---

## Always-on daemon (1)

| # | Name | Cadence | Script | Notes |
|---|---|---|---|---|
| 1 | `cruz-bot` | 🟢 autorestart | `scripts/telegram-bot.js` | Telegram bot daemon — listens for commands, emits alerts. Restart-on-crash only; no cron. |

---

## Continuous intake (every 5–30 min) — 5 processes

| # | Name | Cadence | Script | Contract | Notes |
|---|---|---|---|---|---|
| 2 | `email-intake` | ⏰ `*/15 * * * *` | `scripts/email-intake.js` | 💾📣 | Pull Gmail → classify → write to `email_inbox`. Anthropic Sonnet. |
| 3 | `globalpc-delta-sync` | ⏰ `*/15 * * * *` | `scripts/globalpc-delta-sync.js` | 💾📣🧭 | Sync only changed rows from GlobalPC MySQL `bd_demo_38`. Block EE contract — every write MUST include `company_id`. |
| 4 | `heartbeat` | ⏰ `*/15 * * * *` | `scripts/heartbeat.js` | 💾📣 | Health beacon — writes `heartbeat_log`. If missing > 45 min → `red` in data-integrity probe. |
| 5 | `mensajeria-email-fallback` | ⏰ `*/10 * * * *` | `scripts/mensajeria-email-fallback.js` | 💾 | Outbound email for messages where client prefers email over in-app. |
| 6 | `econta-intraday` | ⏰ `*/30 * * * *` | `scripts/full-sync-econta.js` | 💾📣🧭 | **sync-contract.md §1** — 30-min freshness promise for `/mi-cuenta` + Contabilidad tile. Config share with #27 below. |

## Fast-cycle monitoring (every 5 min–2 h) — 3 processes

| # | Name | Cadence | Script | Contract | Notes |
|---|---|---|---|---|---|
| 7 | `semaforo-watch` | ⏰ `*/5 * * * *` | `scripts/semaforo-watch.js` | 💾📣 | Watches `traficos.semaforo` transitions verde→rojo; alerts when a shipment is flagged. |
| 8 | `risk-scorer` | ⏰ `0 */2 * * *` | `scripts/risk-scorer.js` | 💾📣 | Re-scores active tráficos every 2h. Used by `risk-feed` and `/admin/eagle`. |
| 9 | `risk-feed` | ⏰ `0 * * * *` | `scripts/risk-feed.js` | 💾📣 | Hourly emit of risk-feed rows to `risk_feed` table. |

## Daily operational jobs — 7 processes

| # | Name | Cadence | Script | Contract | Notes |
|---|---|---|---|---|---|
| 10 | `econta-nightly-full` | ⏰ `0 1 * * *` | `scripts/full-sync-econta.js` | 💾📣🧭 | 01:00 CST authoritative pass — full econta mirror. Reuses `full-sync-econta.js` with env flag controlling intraday-vs-full. |
| 11 | `pipeline-postmortem` | ⏰ `0 2 * * *` | `scripts/pipeline-postmortem.js` | 💾📣 | 02:00 — diff yesterday's sync deltas; alert if coverage dropped >2%. |
| 12 | `wsdl-anexo24-pull` | ⏰ `15 2 * * *` | `scripts/wsdl-anexo24-pull.js` | 💾📣 | 02:15 — pull SOAP Formato 53 from GlobalPC. Method name pending Mario confirmation; falls back to inbox path. |
| 13 | `v2c-batch` | ⏰ `0 3 * * *` | `scripts/v2c-managed-agent/nightly-batch.js` | 💾📣 | 03:00 — V2C managed-agent batch run. Writes `docs/v2c-batch-reports/YYYY-MM-DD.md`. |
| 14 | `feedback-loop` | ⏰ `0 4 * * *` | `scripts/feedback-loop.js` | 💾📣 | 04:00 — aggregates Tito corrections into training signal. |
| 15 | `clearance-sandbox` | ⏰ `0 5 * * *` | `scripts/sandbox/clearance-sandbox.js` | 💾 | 05:00 — runs clearance simulations; writes to `sandbox_runs`. |
| 16 | `doc-prerequest` | ⏰ `0 6 * * *` | `scripts/doc-prerequest.js` | 💾📣 | 06:00 — emails suppliers for missing docs (draft only — Tito-approved before send). |
| 17 | `completeness-checker` | ⏰ `0 6 * * *` | `scripts/completeness-checker.js` | 💾📣 | 06:00 — flags tráficos with incomplete expedientes. Feeds `/admin/eagle` alert panel. |
| 18 | `tito-daily-briefing` | ⏰ `30 6 * * *` | `scripts/tito-daily-briefing.js` | 💾📣 | 06:30 — Telegram morning brief to Tito. Includes semáforo holds, MVE countdowns, overnight alerts. |
| 19 | `client-briefing-generator` | ⏰ `0 7 * * 1-5` | `scripts/generate-client-briefing.js` | 💾📣 | 07:00 weekdays — per-client Anthropic-generated digest. Dedup Telegram on credit failure. |
| 20 | `patentes-watch` | ⏰ `0 8 * * *` | `scripts/patentes-watch.js` | 💾📣 | 08:00 — monitors patente validity + SAT-side status. |
| 21 | `vencimientos-watch` | ⏰ `0 9 * * *` | `scripts/vencimientos-watch.js` | 💾📣 | 09:00 — surfaces upcoming deadline expirations (MVE, Anexo 24, etc). |

## Weekly jobs — 6 processes

| # | Name | Cadence | Script | Contract | Notes |
|---|---|---|---|---|---|
| 22 | `globalpc-sync` | ⏰ `0 1 * * 0,3,6` | `scripts/globalpc-sync.js` | 💾📣🧭 | 01:00 Sun/Wed/Sat — full GlobalPC reconciliation. Tenant-isolation.md Block-EE contract. |
| 23 | `full-sync-facturas` | ⏰ `0 2 * * 0` | `scripts/full-sync-facturas.js` | 💾📣 | Sunday 02:00 — authoritative GlobalPC facturas rewrite. |
| 24 | `seed-tariff-rates` | ⏰ `0 3 * * 0` | `scripts/seed-tariff-rates.js` | 💾 | Sunday 03:00 — refresh `tariff_rates` from SAT source. **KNOWN BUG (CLAUDE.md): wrong column reference `cve_trafico`** — Tier 2 fix. |
| 25 | `backfill-proveedor-rfc` | ⏰ `0 3 * * 0` | `scripts/backfill-proveedor-rfc.js` | 💾📣 | Sunday 03:00 — resolves missing RFCs via `proveedor_rfc_cache`. |
| 26 | `backfill-transporte` | ⏰ `30 3 * * 0` | `scripts/backfill-transporte.js` | 💾 | Sunday 03:30 — carrier-normalization pass. |
| 27 | `econta-reconciler` | ⏰ `0 4 * * 1` | `scripts/econta-reconciler.js` | 💾📣🧭 | Monday 04:00 — weekly drift check between local `econta_*` tables and eConta MySQL. |

## Twice-monthly jobs — 1 process

| # | Name | Cadence | Script | Contract | Notes |
|---|---|---|---|---|---|
| 28 | `anexo24-reconciler` | ⏰ `0 3 1,15 * *` | `scripts/anexo24-reconciler.js` | 💾📣 | 1st + 15th of month at 03:00 — reconcile our Anexo 24 against SAT. |

---

## Silent-failure audit — known gaps (Tier 2)

Per CLAUDE.md §PIPELINE HEALTH and core-invariants rule 18: every cron must
log to Supabase AND fire Telegram on failure. Spot-check:

- **`po-predictor.js`** — `scripts/po-predictor.js:47` has `.catch(() => {})` that
  swallows Telegram-send errors. Also `main().catch` may not `process.exit(1)`.
  Fix scheduled Tier 2 this week.
- **`seed-tariff-rates`** — uses wrong column name `cve_trafico` (should be
  `cve_pedimento` or similar). CLAUDE.md-documented bug. Tier 2.
- **`backfill-doc-types.js`** — wrong column reference `expediente_documentos.nombre`.
  Not in ecosystem.config — ad-hoc script. Verify before running.
- **Pattern sweep needed:** `grep -rn "\.catch(() => {})" scripts/` across all 28
  to find the same swallow-pattern.

## Dependencies between processes

- `globalpc-delta-sync` (#3) must finish within 15 min so the next run doesn't
  overlap; checkpoint-resumable design tolerates crashes.
- `wsdl-anexo24-pull` (#12) at 02:15 runs AFTER `globalpc-sync` (#22 at 01:00)
  so partidas exist for reconciliation.
- `tito-daily-briefing` (#18 at 06:30) depends on all earlier-morning jobs
  completing — if `completeness-checker` (#17 at 06:00) hasn't finished,
  Tito's brief misses same-day missing-doc alerts.
- `/api/health/data-integrity` probes jobs marked 🧭 — if any of those
  sync_log entries are stale >45 min, the live smoke gate of `npm run ship`
  flips amber; >90 min flips red.

## How to add a new cron

1. Add entry to `ecosystem.config.js` with `name`, `script`, `cron_restart`.
2. Script MUST use the structured-log helper (`scripts/lib/sync-log-helper.js`
   or equivalent) — every run writes `{started_at, finished_at, status, rows}`
   to `sync_log`.
3. Script MUST call `sendTelegram('❌ ...')` on failure and `process.exit(1)`.
4. Add row to this manifest in the same commit.
5. Deploy on Throne: `pm2 reload ecosystem.config.js --only <name>` then
   `pm2 save`.
6. Verify next run with `pm2 logs <name> --lines 50`.

Missing any of steps 1–5 is a regression against core-invariants rule 18.

---

*Manifest codified 2026-04-19 night — prevents the "pm2 process died for
10 days" class of incident by giving every cadence a visible home.*

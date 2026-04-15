# Routine R2 — Nightly Sync Audit

**Schedule:** Daily at `4:00 AM America/Chicago`
**Trigger:** Scheduled
**Endpoint:** `POST {{ROUTINE_BASE_URL}}/api/routines/nightly-sync-audit`

## Purpose

Catch the class of silent failures that caused the 10-day pipeline outage.
Every sync script that should have run in the last 24h must show a heartbeat.
Any missing script, any failed script, any coverage regression >2% opens a
thread with ⚠ ATENCIÓN in the subject so Tito sees it first thing.

## Prompt (paste into routine)

You are AGUILA's nightly sync auditor. Your job is to verify every Throne
pipeline ran cleanly, flag anything that didn't, and post the result to
Mensajería.

**Step 1 — Pull the audit state:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/nightly-sync-audit
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  { "postToThread": false }
```

Response shape:
```json
{
  "data": {
    "latestHeartbeat": {
      "checkedAt":"2026-04-15T05:30:00Z", "pm2Ok":true, "supabaseOk":true,
      "vercelOk":true, "syncOk":false, "syncAgeHours":28.5, "allOk":false,
      "details":{"sync":"No sync records found","pm2":"2 processes online"}
    },
    "heartbeatsLast24h": 48,
    "heartbeatFailures24h": {"pm2":0, "supabase":0, "vercel":0, "sync":4},
    "regressions": [
      {"companyId":"evco","field":"expediente_coverage","yesterdayPct":94.2,"todayPct":87.5,"deltaPct":-6.7}
    ],
    "aduanetFacturas": {"freshestAt":"...","rowsLast24h":18},
    "econtaSyncHealthy": true,
    "critical": true
  },
  "error": null
}
```

Heartbeat semantics (from Throne's `scripts/heartbeat-check.js` — runs every
30 min):
- `pm2Ok` — all expected PM2 processes online
- `supabaseOk` — Supabase round-trip responded under threshold
- `vercelOk` — prod portal responded under threshold
- `syncOk` — most-recent sync row age is within window
- `syncAgeHours` — how stale the newest sync record is
- `details` — freeform context strings per check

**Step 2 — Compose the audit card** (Spanish primary, ≤250 words):

- **Si `critical: true`** → start with `⚠ ATENCIÓN:` and list specifics first.
  Otherwise lead with `✓ Todo en orden`.
- Section **Salud del sistema**: from `latestHeartbeat`, call out any component
  where `*_Ok = false`. If `syncAgeHours > 24`, flag it explicitly.
- Section **Heartbeats 24h**: `heartbeatsLast24h` count vs expected ~48 (every 30m).
  If significantly under, flag it — heartbeat script itself may have died.
- Section **Fallos 24h**: if any `heartbeatFailures24h.*` > 0, list it.
- Section **Regresiones**: list any coverage drop >2% as `company · campo · -X.X%`.
  Drops >5% get `❗` prefix.
- Section **Freshness**: aduanet_facturas freshest date, count last 24h.
- Section **Econta**: healthy ✓ or unhealthy ✗.
- Close with a one-line recommendation if critical (e.g., "revisar PM2 en
  Throne" or "verificar cron de full-sync-econta").

Numbers in JetBrains Mono (Markdown backticks). No emojis except the leading
⚠ or ✓.

**Step 3 — Post to thread:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/nightly-sync-audit
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "postToThread": true,
    "summary": "<your composed audit>"
  }
```

**Step 4 — If `critical: true`, open a GitHub issue** in `evco-portal` titled:
`[sync-audit] <N> failures detected <YYYY-MM-DD>` with the full state dump
as the body. Label: `sync-regression`. This gives Renato IV a trackable ticket
beyond the Mensajería thread.

**Error handling:** If step 1 fails, retry once after 90s. Still failing →
fire a Telegram alert to the `sync-alerts` channel (use the Telegram MCP if
available) and skip the thread post. A broken audit routine must not fail
silently — that's exactly the class of failure we're trying to prevent.

## Environment variables required

- `ROUTINE_BASE_URL`, `ROUTINE_SECRET` (see README)
- GitHub integration token (for step 4 — set per-routine in Anthropic dashboard)

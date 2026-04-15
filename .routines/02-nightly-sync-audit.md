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
    "scripts": [
      {"script":"full-sync-econta","status":"success","lastRunAt":"...","errorMessage":null},
      {"script":"globalpc-delta-sync","status":"failed","lastRunAt":"...","errorMessage":"timeout"},
      {"script":"regression-guard","status":"missing","lastRunAt":null,"errorMessage":null}
    ],
    "failedScripts": ["globalpc-delta-sync"],
    "missingScripts": ["regression-guard"],
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

**Step 2 — Compose the audit card** (Spanish primary, ≤250 words):

- **Si `critical: true`** → start with `⚠ ATENCIÓN:` and list specifics first.
  Otherwise lead with a green `✓ Todo en orden`.
- Section **Scripts**: list any failed / missing with timestamp (none if all clean).
- Section **Regresiones**: list any coverage drop >2% as `company · campo · -X.X%`.
  Highlight drops >5% with bold or `❗`.
- Section **Freshness**: aduanet_facturas freshest date, count last 24h.
- Section **Econta**: healthy ✓ or unhealthy ✗.
- Close with a one-line recommendation if critical (e.g., "revisar PM2 en Throne y reiniciar regression-guard").

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

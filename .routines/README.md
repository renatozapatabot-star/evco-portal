# AGUILA Routines

Anthropic Claude Routines that replace Throne PM2 processes. Silent failure
becomes impossible — Anthropic manages uptime.

## Architecture

Each routine is a two-part thing:

1. **Prompt spec** in this directory (`.routines/<name>.md`) — natural-language
   instructions the routine runs on its schedule. Paste into the dashboard.
2. **API endpoint** at `src/app/api/routines/<name>/route.ts` — the thing the
   routine calls to pull data / trigger actions. Gated by `ROUTINE_SECRET`.

## Setup (one-time)

1. Go to <https://claude.ai/code/routines>
2. Connect the `evco-portal` GitHub repo
3. Set environment variables (all required):

   | Var | Purpose |
   |---|---|
   | `ROUTINE_BASE_URL` | `https://portal.renatozapata.com` — where routines POST |
   | `ROUTINE_SECRET` | Shared secret. Generate via `openssl rand -hex 32`. Also set on Vercel. |
   | `ANTHROPIC_API_KEY` | Routines may call Claude to summarize — same key as the app |

4. For each `.routines/*.md` file: create a new routine, paste the prompt,
   set the schedule.

## Activation order

Ship in this order — each proves the pattern before the next:

1. **`01-morning-briefing.md`** — daily 7:00 AM Central. First victory.
2. **`02-nightly-sync-audit.md`** — daily 4:00 AM Central. Catches silent failures.
3. **`03-semaforo-rojo.md`** — event-triggered webhook. Immediate Mensajería alert.
4. **`04-anomaly-detector.md`** — weekly Sunday 9:00 PM. Invoice + pedimento anomalies.
5. **`05-weekly-client-reports.md`** — weekly Monday 6:00 AM. Per-client summaries.
6. **`.github/workflows/pr-gate.yml`** — GitHub Action, not a routine. Runs on every PR.

## Secret rotation

```bash
# 1. New secret
openssl rand -hex 32

# 2. Update both:
#    - Vercel env → ROUTINE_SECRET
vercel env rm ROUTINE_SECRET production
printf "<new-secret>" | vercel env add ROUTINE_SECRET production

#    - Anthropic dashboard → each routine's ROUTINE_SECRET var

# 3. Redeploy Vercel so new secret applies
vercel --prod
```

No coordination needed — next routine run picks up the new secret as long as
both sides match.

## Auth contract

Every `/api/routines/*` request MUST include:

```
POST /api/routines/<name>
Headers:
  Content-Type: application/json
  x-routine-secret: <ROUTINE_SECRET value>
Body:
  { ...routine-specific payload }
```

Shape on success:
```json
{ "data": { ...}, "error": null }
```

Shape on error:
```json
{ "data": null, "error": { "code": "UNAUTHORIZED|VALIDATION_ERROR|INTERNAL_ERROR", "message": "..." } }
```

## Why not keep PM2 on Throne?

The nightly pipeline silently died for 10 days and nobody noticed. Anthropic's
infrastructure doesn't have that failure mode — routines log each execution,
retry on failure, and surface errors in the dashboard. Moving critical
scheduled work off Throne is a resilience upgrade, not a convenience.

Telegram pipeline alerts remain for Throne-native work (fleet syncs, email
classification, etc). Routines handle everything new.

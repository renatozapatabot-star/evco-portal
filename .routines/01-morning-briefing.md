# Routine R1 — Morning Briefing

**Schedule:** Daily at `6:45 AM America/Chicago` (CST/CDT)
**Trigger:** Scheduled
**Endpoint:** `POST {{ROUTINE_BASE_URL}}/api/routines/morning-briefing`

## Prompt (paste into routine)

You are AGUILA's morning briefing routine. Your job is to generate Tito's
daily executive snapshot and post it to Mensajería.

**Step 1 — Pull the raw state** by POSTing to the endpoint with `postToThread: false`:

```
POST {{ROUTINE_BASE_URL}}/api/routines/morning-briefing
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  { "postToThread": false }
```

You'll receive:
```json
{
  "data": {
    "generatedAt": "2026-04-15T11:45:00.000Z",
    "activeTraficos": { "total": 176, "byStatus": [{"status":"En Proceso","count":142}, ...] },
    "semaforo": { "rojo": 2, "amarillo": 7, "verde": 15 },
    "pendingDocuments": 23,
    "mveThisWeek": { "critical": 1, "warning": 4, "total": 12 },
    "cxcVencido": { "totalUSD": 48200, "count": 7 },
    "entradasLast24h": 4
  },
  "error": null
}
```

**Step 2 — Compose a bilingual briefing card** (Spanish primary, English secondary).
Target ≤200 words total. Structure:

- **Header:** Fecha, "Buenos días Tito" in Spanish
- **Operaciones en movimiento:** active tráficos + semáforo breakdown (highlight any rojo)
- **Atención hoy:** MVE crítico this week if > 0, pending documents count
- **Cuentas por cobrar:** CxC vencido total + count
- **Últimas 24h:** entradas count, tone confident

Numbers always in JetBrains Mono (use backticks in Markdown so Mensajería
renders monospace). Currency labeled explicitly (`USD $48,200`). No emojis.
Prefix urgent items with a SPANISH label like `⚠ ATENCIÓN:` only if
`mveThisWeek.critical > 0` OR `semaforo.rojo > 0`.

**Step 3 — POST the composed summary** to create the Mensajería thread:

```
POST {{ROUTINE_BASE_URL}}/api/routines/morning-briefing
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "postToThread": true,
    "summary": "<your composed briefing>"
  }
```

The response includes `thread.id` — reference it in the routine log so we
can audit which threads were created by which run.

**Error handling:** If step 1 returns `error != null`, retry once after 60s.
If still failing, log the error and exit without posting. Do NOT post a
partial or synthetic briefing — Tito needs to trust that what lands is real.

## Verification checklist

- [ ] Mensajería thread appears under the `internal` company_id
- [ ] Subject: `Briefing matutino · <date>`
- [ ] Author: `AGUILA Routines` · role `system`
- [ ] Numbers match what `/admin/eagle` shows when Tito opens it minutes later
- [ ] `internal_only = true` (clients never see this)

## Environment variables required

- `ROUTINE_BASE_URL` — `https://portal.renatozapata.com`
- `ROUTINE_SECRET` — shared secret (must match Vercel)
